import type {
  D1Database,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { apiKey } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "../db";
import type { CloudflareBindings } from "../env";

// Single auth configuration that handles both CLI and runtime scenarios
function createAuth(
  env?: CloudflareBindings,
  cf?: IncomingRequestCfProperties
) {
  const db = env ? drizzle(env.SUM_DB, { schema, logger: true }) : undefined;
  const trustedOrigins = env?.CORS_ORIGIN?.split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  return betterAuth({
    secret: env?.BETTER_AUTH_SECRET,
    baseURL: env?.BETTER_AUTH_BASE_URL,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1:
          env && db
            ? {
                db,
                options: {
                  usePlural: true,
                  debugLogs: true,
                },
              }
            : undefined,
        kv: env?.SUM_KV,
      },
      {
        trustedOrigins:
          trustedOrigins && trustedOrigins.length > 0
            ? trustedOrigins
            : ["http://localhost:5173", "http://127.0.0.1:5173"],
        emailAndPassword: {
          enabled: true,
        },
        plugins: [
          apiKey({
            enableSessionForAPIKeys: true,
            apiKeyHeaders: ["x-api-key"],
            defaultPrefix: "spin_",
          }),
        ],
        rateLimit: {
          enabled: true,
        },
      }
    ),
    // Only add database adapter for CLI schema generation
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: "sqlite",
            usePlural: true,
            debugLogs: true,
          }),
        }),
  });
}

// Export for runtime usage
export { createAuth };
