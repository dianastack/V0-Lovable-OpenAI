import type { Config } from "drizzle-kit";
import path from "path";

const devDbPath = path.resolve("./userData/sqlite.db");

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: devDbPath,
  },
} satisfies Config;
