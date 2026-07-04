export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/** Duração da sessão (cookie + validade do JWT). */
export const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
/** Opções do cookie de sessão — usadas no login e no logout (precisam casar). */
export const sessionCookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction, // HTTPS em produção; localhost continua funcionando em dev
  path: "/",
});
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
