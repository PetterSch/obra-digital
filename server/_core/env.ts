export const ENV = {
  jwtSecret:    process.env.JWT_SECRET    ?? "",
  databaseUrl:  process.env.MYSQL_URL ?? process.env.DATABASE_URL ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel:  process.env.OPENAI_MODEL  ?? "gpt-4o-mini",
  isProduction: process.env.NODE_ENV === "production",
};
