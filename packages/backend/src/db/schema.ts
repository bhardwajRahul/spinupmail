import * as authSchema from "./auth.schema"; // This will be generated in a later step
import * as emailSchema from "./email.schema";

// Combine all schemas here for migrations
export const schema = {
  ...authSchema,
  ...emailSchema,
  // ... your other application schemas
} as const;
