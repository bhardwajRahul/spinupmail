import { createAuthClient } from "better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";

const baseURL = import.meta.env.VITE_AUTH_BASE_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [apiKeyClient()],
});
