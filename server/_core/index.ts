import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`Nenhuma porta disponível a partir de ${startPort}`);
}

async function startServer() {
  console.log("[Startup] MYSQL_URL definida:", !!process.env.MYSQL_URL, "| DATABASE_URL:", !!process.env.DATABASE_URL);
  console.log("[Startup] NODE_ENV:", process.env.NODE_ENV);
  // Diagnóstico: lista nomes de variáveis relevantes injetadas
  const relevantes = Object.keys(process.env).filter(k =>
    /MYSQL|DATABASE|DB_|JWT|RAILWAY|PG|NODE_ENV|PORT/i.test(k)
  );
  console.log("[Diag] Variáveis relevantes no ambiente:", relevantes.join(", ") || "NENHUMA");

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // tRPC
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Testa conexão com banco na inicialização
  await getDb();

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Porta ${preferredPort} ocupada, usando ${port}`);
  server.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}/`));
}

startServer().catch(console.error);
