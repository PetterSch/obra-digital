import { defineConfig } from "drizzle-kit";

const connectionString = process.env.MYSQL_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MYSQL_URL or DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  } as any,
});
