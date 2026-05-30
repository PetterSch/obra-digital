export const ENV = {
  jwtSecret:    process.env.JWT_SECRET    ?? "obra-digital-secret-key-mude-em-producao",
  databaseUrl:  process.env.DATABASE_URL  ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel:  process.env.OPENAI_MODEL  ?? "gpt-4o-mini",
  isProduction: process.env.NODE_ENV === "production",
};
