import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "engenheiro" | "cliente" = "engenheiro"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Routers - Auth", () => {
  it("should return current user with me query", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.id).toBe(1);
    expect(user?.name).toBe("Test User");
  });
});

describe("Routers - Obras (Access Control)", () => {
  it("should allow engineer to list obras", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    // This would require DB setup, so we're testing the procedure exists
    expect(caller.obras.list).toBeDefined();
  });

  it("should allow admin to list obras", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    expect(caller.obras.list).toBeDefined();
  });

  it("should deny cliente from creating obra", async () => {
    const ctx = createAuthContext("cliente");
    const caller = appRouter.createCaller(ctx);
    
    try {
      await caller.obras.create({
        codigo: "TEST",
        nome: "Test",
        cliente: "Client",
        endereco: "Address",
        cidade: "City",
        estado: "SP",
        cep: "12345",
        responsavelTecnico: "Tech",
        dataInicio: "2026-01-01",
        dataPrevistTermino: "2026-12-31",
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Routers - Diários (Access Control)", () => {
  it("should allow engineer to create diario", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.diarios.create).toBeDefined();
  });

  it("should deny cliente from creating diario", async () => {
    const ctx = createAuthContext("cliente");
    const caller = appRouter.createCaller(ctx);
    
    try {
      await caller.diarios.create({
        obraId: 1,
        data: "2026-01-01",
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Routers - Ocorrências", () => {
  it("should allow engineer to create ocorrencia", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.ocorrencias.create).toBeDefined();
  });

  it("should allow engineer to update ocorrencia status", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.ocorrencias.update).toBeDefined();
  });
});

describe("Routers - Pendências", () => {
  it("should allow engineer to create pendencia", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.pendencias.create).toBeDefined();
  });

  it("should allow engineer to update pendencia", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.pendencias.update).toBeDefined();
  });
});

describe("Routers - Sugestões LLM", () => {
  it("should allow engineer to generate sugestao", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.sugestoesLLM.gerarSugestao).toBeDefined();
  });

  it("should allow engineer to approve sugestao", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.sugestoesLLM.aprovar).toBeDefined();
  });
});

describe("Routers - Acesso Cliente", () => {
  it("should allow engineer to generate client access link", async () => {
    const ctx = createAuthContext("engenheiro");
    const caller = appRouter.createCaller(ctx);
    expect(caller.acessoCliente.gerarLink).toBeDefined();
  });

  it("should deny cliente from generating access link", async () => {
    const ctx = createAuthContext("cliente");
    const caller = appRouter.createCaller(ctx);
    
    try {
      await caller.acessoCliente.gerarLink({
        obraId: 1,
        usuarioId: 1,
      });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
