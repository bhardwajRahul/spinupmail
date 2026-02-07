import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { createAuth } from "./auth";
import { emailAddresses, emails, schema } from "./db";
import type {
  ExecutionContext,
  ForwardableEmailMessage,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import type { CloudflareBindings } from "./env";

type CfReadableStream =
  import("@cloudflare/workers-types").ReadableStream<Uint8Array>;

type AuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>
>;

type Variables = {
  auth: ReturnType<typeof createAuth>;
  session: AuthSession;
};

const app = new Hono<{ Bindings: CloudflareBindings; Variables: Variables }>();

const EMAIL_LIST_LIMIT_DEFAULT = 20;
const EMAIL_LIST_LIMIT_MAX = 100;
const EMAIL_MAX_BYTES_DEFAULT = 512 * 1024;

const getDb = (env: CloudflareBindings) => drizzle(env.SUM_DB, { schema });

const normalizeAddress = (address: string) => address.trim().toLowerCase();

const sanitizeLocalPart = (value: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, "");
  return cleaned.replace(/^\.+|\.+$/g, "").slice(0, 64);
};

const parseOptionalTimestamp = (value: string | null) => {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return new Date(numeric);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return undefined;
  return new Date(parsed);
};

const clampNumber = (
  value: string | null,
  min: number,
  max: number,
  fallback: number
) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth");
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.session || !session?.user) {
    c.status(401);
    return c.json({ error: "unauthorized" });
  }
  c.set("session", session as AuthSession);
  await next();
};

const readJsonBody = async <T>(c: Parameters<MiddlewareHandler>[0]) => {
  try {
    return (await c.req.json()) as T;
  } catch {
    return {} as T;
  }
};

const readRawWithLimit = async (
  stream: ReadableStream<Uint8Array> | CfReadableStream,
  maxBytes: number
) => {
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let truncated = false;
  const parts: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;

    if (bytes + value.length > maxBytes) {
      const slice = value.slice(0, Math.max(0, maxBytes - bytes));
      if (slice.length > 0) {
        parts.push(decoder.decode(slice, { stream: true }));
        bytes += slice.length;
      }
      truncated = true;
      await reader.cancel();
      break;
    }

    parts.push(decoder.decode(value, { stream: true }));
    bytes += value.length;
  }

  parts.push(decoder.decode());

  return {
    raw: parts.join(""),
    bytes: Math.min(bytes, maxBytes),
    truncated,
  };
};

const splitHeadersAndBody = (content: string) => {
  const match = content.match(/\r?\n\r?\n/);
  if (!match || match.index === undefined) {
    return { headerText: "", body: content };
  }
  const index = match.index;
  const separatorLength = match[0].length;
  return {
    headerText: content.slice(0, index),
    body: content.slice(index + separatorLength),
  };
};

const parseHeaderBlock = (headerText: string) => {
  const headers: Record<string, string> = {};
  const lines = headerText.replace(/\r\n/g, "\n").split("\n");
  let currentName: string | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (/^\s/.test(line) && currentName) {
      headers[currentName] = `${headers[currentName]} ${line.trim()}`.trim();
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
    currentName = name;
  }

  return headers;
};

const parseContentType = (value?: string | null) => {
  if (!value)
    return { mime: "", boundary: null as string | null, charset: null };
  const [rawMime, ...params] = value.split(";").map(part => part.trim());
  let boundary: string | null = null;
  let charset: string | null = null;

  for (const param of params) {
    const [key, rawValue] = param.split("=");
    if (!key || !rawValue) continue;
    const normalizedKey = key.trim().toLowerCase();
    const cleaned = rawValue.trim().replace(/^"|"$/g, "");
    if (normalizedKey === "boundary") boundary = cleaned;
    if (normalizedKey === "charset") charset = cleaned;
  }

  return { mime: rawMime.toLowerCase(), boundary, charset };
};

const decodeBase64 = (input: string) => {
  const cleaned = input.replace(/\s+/g, "");
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return input;
  }
};

const decodeQuotedPrintable = (input: string) => {
  const cleaned = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (
      char === "=" &&
      i + 2 < cleaned.length &&
      /[0-9A-Fa-f]{2}/.test(cleaned.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    bytes.push(char.charCodeAt(0));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};

const decodeBody = (input: string, encoding?: string | null) => {
  const normalized = encoding?.toLowerCase().trim();
  if (!normalized) return input;
  if (normalized === "base64") return decodeBase64(input);
  if (normalized === "quoted-printable") return decodeQuotedPrintable(input);
  return input;
};

const extractBodiesFromRaw = (
  raw: string,
  contentTypeHeader?: string | null
) => {
  const { headerText, body } = splitHeadersAndBody(raw);
  const topHeaders = parseHeaderBlock(headerText);
  if (contentTypeHeader) {
    topHeaders["content-type"] = contentTypeHeader;
  }

  const walkPart = (
    headers: Record<string, string>,
    partBody: string
  ): { html?: string; text?: string } => {
    const { mime, boundary } = parseContentType(headers["content-type"]);
    const encoding = headers["content-transfer-encoding"];

    if (mime.startsWith("text/html")) {
      return { html: decodeBody(partBody, encoding).trim() };
    }
    if (mime.startsWith("text/plain")) {
      return { text: decodeBody(partBody, encoding).trim() };
    }
    if (mime.startsWith("multipart/") && boundary) {
      const delimiter = `--${boundary}`;
      const sections = partBody.split(delimiter);
      let fallbackText: string | undefined;
      for (const section of sections) {
        const cleaned = section.replace(/^\r?\n/, "").trim();
        if (!cleaned || cleaned === "--") continue;
        if (cleaned.startsWith("--")) continue;
        const { headerText: innerHeaders, body: innerBody } =
          splitHeadersAndBody(cleaned);
        const parsedHeaders = parseHeaderBlock(innerHeaders);
        const result = walkPart(parsedHeaders, innerBody);
        if (result.html) return result;
        if (result.text && !fallbackText) fallbackText = result.text;
      }
      return fallbackText ? { text: fallbackText } : {};
    }

    return {};
  };

  return walkPart(topHeaders, body);
};

// CORS configuration for auth routes
app.use(
  "/api/**",
  cors({
    origin: "*", // In production, replace with your actual domain
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    allowMethods: ["POST", "GET", "OPTIONS", "DELETE"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Middleware to initialize auth instance for each request
app.use("*", async (c, next) => {
  const cf =
    ("cf" in c.req.raw
      ? (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf
      : undefined) ?? ({} as IncomingRequestCfProperties);
  const auth = createAuth(c.env, cf);
  c.set("auth", auth);
  await next();
});

// Handle all auth routes
app.all("/api/auth/*", async c => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.use("/api/email-addresses", requireAuth);
app.use("/api/email-addresses/*", requireAuth);
app.use("/api/emails", requireAuth);
app.use("/api/emails/*", requireAuth);

app.get("/api/email-addresses", async c => {
  const session = c.get("session");
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(emailAddresses)
    .where(eq(emailAddresses.userId, session.user.id))
    .orderBy(desc(emailAddresses.createdAt));

  const items = rows.map(row => {
    let parsedMeta: unknown = null;
    if (row.meta) {
      try {
        parsedMeta = JSON.parse(row.meta);
      } catch {
        parsedMeta = row.meta;
      }
    }

    return {
      id: row.id,
      address: row.address,
      localPart: row.localPart,
      domain: row.domain,
      tag: row.tag,
      meta: parsedMeta,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      createdAtMs: row.createdAt ? row.createdAt.getTime() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      expiresAtMs: row.expiresAt ? row.expiresAt.getTime() : null,
      lastReceivedAt: row.lastReceivedAt
        ? row.lastReceivedAt.toISOString()
        : null,
      lastReceivedAtMs: row.lastReceivedAt
        ? row.lastReceivedAt.getTime()
        : null,
    };
  });

  return c.json({ items });
});

app.post("/api/email-addresses", async c => {
  type CreateBody = {
    localPart?: string;
    prefix?: string;
    tag?: string;
    ttlMinutes?: number;
    meta?: unknown;
    domain?: string;
  };

  const session = c.get("session");
  const body = await readJsonBody<CreateBody>(c);
  const domainFromEnv = c.env.EMAIL_DOMAIN?.trim().toLowerCase();
  const domainFromBody =
    typeof body.domain === "string" && body.domain.trim().length > 0
      ? body.domain.trim().toLowerCase()
      : undefined;
  const domain = domainFromBody ?? domainFromEnv;

  if (!domain) {
    c.status(400);
    return c.json({ error: "EMAIL_DOMAIN is not configured" });
  }

  if (domainFromBody && domainFromEnv && domainFromBody !== domainFromEnv) {
    c.status(400);
    return c.json({ error: "domain is not allowed" });
  }

  const prefix =
    typeof body.prefix === "string" && body.prefix.trim().length > 0
      ? body.prefix
      : "test";
  const providedLocalPart =
    typeof body.localPart === "string" ? body.localPart : "";
  let localPart = sanitizeLocalPart(providedLocalPart);
  if (!localPart) {
    const safePrefix = sanitizeLocalPart(prefix) || "test";
    const suffix = crypto.randomUUID().split("-")[0];
    localPart = `${safePrefix}-${suffix}`;
  }

  const address = normalizeAddress(`${localPart}@${domain}`);
  const now = Date.now();
  const ttlMinutes =
    typeof body.ttlMinutes === "number" ? body.ttlMinutes : undefined;
  const expiresAtMs =
    ttlMinutes && ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : undefined;
  const expiresAt = expiresAtMs ? new Date(expiresAtMs) : undefined;

  let meta: string | undefined;
  if (body.meta !== undefined) {
    if (typeof body.meta === "string") {
      meta = body.meta;
    } else {
      try {
        meta = JSON.stringify(body.meta);
      } catch {
        meta = undefined;
      }
    }
  }

  const db = getDb(c.env);
  const existing = await db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, address))
    .get();
  if (existing) {
    c.status(409);
    return c.json({
      error: "address already exists",
      address,
      id: existing.id,
    });
  }

  const id = crypto.randomUUID();
  await db
    .insert(emailAddresses)
    .values({
      id,
      userId: session.user.id,
      address,
      localPart,
      domain,
      tag: typeof body.tag === "string" ? body.tag : undefined,
      meta,
      expiresAt,
      autoCreated: false,
    })
    .run();

  return c.json({
    id,
    address,
    localPart,
    domain,
    tag: typeof body.tag === "string" ? body.tag : undefined,
    meta: body.meta ?? undefined,
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
    expiresAtMs,
  });
});

app.get("/api/emails", async c => {
  const session = c.get("session");
  const query = new URL(c.req.url).searchParams;
  const addressParam = query.get("address");
  const addressIdParam = query.get("addressId");
  const limit = clampNumber(
    query.get("limit"),
    1,
    EMAIL_LIST_LIMIT_MAX,
    EMAIL_LIST_LIMIT_DEFAULT
  );
  const order = query.get("order") === "asc" ? "asc" : "desc";
  const includeRaw = query.get("raw") !== "false" && query.get("raw") !== "0";

  if (!addressParam && !addressIdParam) {
    c.status(400);
    return c.json({ error: "address or addressId is required" });
  }

  const db = getDb(c.env);
  const addressRow = addressIdParam
    ? await db
        .select()
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.id, addressIdParam),
            eq(emailAddresses.userId, session.user.id)
          )
        )
        .get()
    : await db
        .select()
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.address, normalizeAddress(addressParam ?? "")),
            eq(emailAddresses.userId, session.user.id)
          )
        )
        .get();

  if (!addressRow) {
    c.status(404);
    return c.json({ error: "address not found" });
  }

  const after = parseOptionalTimestamp(query.get("after"));
  const before = parseOptionalTimestamp(query.get("before"));
  const conditions = [eq(emails.addressId, addressRow.id)];

  if (after !== undefined) {
    conditions.push(gte(emails.receivedAt, after));
  }
  if (before !== undefined) {
    conditions.push(lte(emails.receivedAt, before));
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions) : conditions[0];

  const rows = await db
    .select()
    .from(emails)
    .where(whereClause)
    .orderBy(order === "asc" ? asc(emails.receivedAt) : desc(emails.receivedAt))
    .limit(limit);

  const items = rows.map(row => {
    let parsedHeaders: unknown = [];
    if (row.headers) {
      try {
        parsedHeaders = JSON.parse(row.headers);
      } catch {
        parsedHeaders = [];
      }
    }

    const base = {
      id: row.id,
      addressId: row.addressId,
      to: row.to,
      from: row.from,
      subject: row.subject,
      messageId: row.messageId,
      headers: parsedHeaders,
      html: row.bodyHtml,
      text: row.bodyText,
      rawSize: row.rawSize,
      rawTruncated: row.rawTruncated,
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
      receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
    };

    return includeRaw ? { ...base, raw: row.raw } : base;
  });

  return c.json({
    address: addressRow.address,
    addressId: addressRow.id,
    items,
  });
});

app.get("/api/emails/:id", async c => {
  const session = c.get("session");
  const emailId = c.req.param("id");
  const includeRaw =
    c.req.query("raw") !== "false" && c.req.query("raw") !== "0";
  const db = getDb(c.env);
  const row = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .get();

  if (!row) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  const addressRow = await db
    .select()
    .from(emailAddresses)
    .where(
      and(
        eq(emailAddresses.id, row.addressId),
        eq(emailAddresses.userId, session.user.id)
      )
    )
    .get();

  if (!addressRow) {
    c.status(404);
    return c.json({ error: "email not found" });
  }

  let parsedHeaders: unknown = [];
  if (row.headers) {
    try {
      parsedHeaders = JSON.parse(row.headers);
    } catch {
      parsedHeaders = [];
    }
  }

  const base = {
    id: row.id,
    addressId: row.addressId,
    address: addressRow?.address,
    to: row.to,
    from: row.from,
    subject: row.subject,
    messageId: row.messageId,
    headers: parsedHeaders,
    html: row.bodyHtml,
    text: row.bodyText,
    rawSize: row.rawSize,
    rawTruncated: row.rawTruncated,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    receivedAtMs: row.receivedAt ? row.receivedAt.getTime() : null,
  };

  return c.json(includeRaw ? { ...base, raw: row.raw } : base);
});

// Home page with anonymous login
app.get("/", c => {
  return c.json({
    status: "ok",
    message: "Spinupmail API is running. Use the frontend to manage inboxes.",
  });
});

// Protected route that shows different content based on auth status
// Simple health check
app.get("/health", c => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const handleIncomingEmail = async (
  message: ForwardableEmailMessage,
  env: CloudflareBindings,
  ctx: ExecutionContext
) => {
  const db = getDb(env);
  const recipient = normalizeAddress(message.to);
  const atIndex = recipient.lastIndexOf("@");

  if (atIndex === -1) {
    message.setReject("Invalid recipient address");
    return;
  }

  const addressRow = await db
    .select({ id: emailAddresses.id })
    .from(emailAddresses)
    .where(eq(emailAddresses.address, recipient))
    .get();

  if (!addressRow) {
    message.setReject("Address not registered");
    return;
  }

  const maxBytesRaw = Number(env.EMAIL_MAX_BYTES);
  const maxBytes =
    Number.isFinite(maxBytesRaw) && maxBytesRaw > 0
      ? maxBytesRaw
      : EMAIL_MAX_BYTES_DEFAULT;
  const { raw, truncated } = await readRawWithLimit(message.raw, maxBytes);
  const { html, text } = extractBodiesFromRaw(
    raw,
    message.headers.get("content-type")
  );

  const headersPairs = [...message.headers];
  const headersJson =
    headersPairs.length > 0 ? JSON.stringify(headersPairs) : undefined;
  const receivedAt = new Date();

  await db
    .insert(emails)
    .values({
      id: crypto.randomUUID(),
      addressId: addressRow.id,
      messageId: message.headers.get("message-id") ?? undefined,
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject") ?? undefined,
      headers: headersJson,
      bodyHtml: html || undefined,
      bodyText: text || undefined,
      raw,
      rawSize: message.rawSize,
      rawTruncated: truncated,
      receivedAt,
    })
    .run();

  ctx.waitUntil(
    db
      .update(emailAddresses)
      .set({ lastReceivedAt: receivedAt })
      .where(eq(emailAddresses.id, addressRow.id))
      .run()
  );

  const forwardTo = env.EMAIL_FORWARD_TO?.trim();
  if (forwardTo) {
    await message.forward(forwardTo);
  }
};

export default {
  fetch: app.fetch,
  email: handleIncomingEmail,
};
