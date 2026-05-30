# Contexto do Projeto — Obra Digital

Este arquivo serve como briefing completo para o Claude Code continuar o desenvolvimento
exatamente de onde parou. Leia antes de qualquer alteração.

---

## O que é o projeto

Sistema profissional de **Diário de Obras Digital** — equivalente a softwares de engenharia
civil do mercado. Permite que engenheiros registrem diariamente tudo que acontece em cada
obra e clientes acompanhem o progresso em tempo real.

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 · Vite · TypeScript · TailwindCSS · Shadcn/UI · Framer Motion |
| Backend | Node.js · Express · tRPC 11 |
| Banco | MySQL 8 · Drizzle ORM |
| Auth | JWT próprio (email + senha + bcrypt) — **sem OAuth externo** |
| IA | OpenAI GPT via `server/_core/llm.ts` (opcional, stub se sem chave) |
| Export | PDF via `window.print()` · Excel via SheetJS (`xlsx`) |

---

## Autenticação (importante)

O projeto usa **auth própria**, sem nenhuma dependência de plataforma externa.

- Login: `POST /api/trpc/auth.login` com email + senha
- Registro: `POST /api/trpc/auth.register`
- Sessão: cookie HTTP-only com JWT assinado por `JWT_SECRET`
- Roles: `admin` | `engenheiro` | `cliente`
- Arquivos-chave: `server/_core/auth.ts`, `server/routers.ts` (router `auth`)

---

## Estrutura de arquivos

```
client/src/
  pages/
    Home.tsx              — redirect para /login ou /dashboard
    Login.tsx             — tela de login/registro
    Dashboard.tsx         — visão geral com gráficos
    ObrasList.tsx         — listagem de obras com busca/filtro
    ObraDetail.tsx        — detalhe da obra (abas: diários, equipes, materiais, pendências, info)
    DiarioObra.tsx        — formulário de novo diário (abas: geral, atividades, mão de obra, equipamentos, ocorrências, fotos)
    DiarioView.tsx        — visualização de um diário + export PDF
    DiarioEdit.tsx        — edição de diário existente
    Relatorios.tsx        — filtro por período + export Excel/PDF
    ResumosPeriodicos.tsx — resumo executivo com IA (semanal/quinzenal/mensal)
    ClientPanel.tsx       — painel somente leitura para clientes
    AdminPanel.tsx        — gestão de usuários e permissões
    Equipes.tsx           — gestão de equipes e operários
    Materiais.tsx         — controle de estoque e movimentações
    Pendencias.tsx        — ocorrências com criticidade e prazo
  components/
    DashboardLayout.tsx   — layout com sidebar recolhível
    MaoDeObraSelector.tsx — seletor de equipes e presenças (reescrito com UX melhorada)
    Map.tsx               — Google Maps direto (VITE_GOOGLE_MAPS_API_KEY no .env)
  lib/
    pdfExport.ts          — exportDiarioPDF() + exportPeriodoPDF()
    exportUtils.ts        — exportDiariosToExcel() + exportResumoToExcel()
    trpc.ts               — cliente tRPC

server/
  routers.ts              — todos os endpoints tRPC (781 linhas)
  db.ts                   — helpers de banco (Drizzle)
  _core/
    auth.ts               — createSessionToken, verifySessionToken, authenticateRequest
    context.ts            — contexto tRPC (injeta ctx.user)
    llm.ts                — invokeLLM() via OpenAI (stub sem chave)
    env.ts                — ENV com JWT_SECRET, DATABASE_URL, OPENAI_API_KEY
    cookies.ts            — getSessionCookieOptions()
    trpc.ts               — publicProcedure, protectedProcedure, router

drizzle/
  schema.ts               — todas as tabelas
  0000_good_lady_bullseye.sql  — migration da tabela users (sem openId/loginMethod)
  0001_charming_the_captain.sql — migration de todas as outras tabelas
```

---

## Banco de dados — entidades principais

```
users           — id, name, email, passwordHash, role, createdAt, lastSignedIn
obras           — id, userId, codigo, nome, cliente, endereco, cidade, estado, cep,
                  responsavelTecnico, crea, dataInicio, dataPrevistTermino,
                  status, percentualAndamento, valorContrato, descricao
diarios         — id, obraId, data, horarioInicio, horarioFim, clima, temperatura,
                  umidade, observacoesGerais, responsavelId
atividades      — id, diarioId, descricao, local, status, percentualConcluido, prioridade
maoDeObra       — id, diarioId, equipeId, operarioId (presença no dia)
equipes         — id, nome, empresa
colaboradores   — id, equipeId, nome, funcao, ativo
equipamentos    — id, diarioId, nome, quantidade, horasUso, observacoes
materiais       — id, obraId, nome, unidade, quantidade, fornecedor
movimentacaoMateriais — id, materialId, tipo (entrada/saida), quantidade, data
ocorrencias     — id, diarioId, descricao, tipo, criticidade, responsavel, prazoSolucao
pendencias      — id, obraId, titulo, descricao, status, criticidade, prazo
midia           — id, diarioId, url, tipo, descricao
relatorios      — id, obraId, tipo, periodo, conteudo, geradoEm
acessoCliente   — id, obraId, usuarioId, tokenAcesso, dataExpiracao, ativo
acessoObra      — id, obraId, usuarioId, permissao
sugestoesLLM    — id, diarioId, texto, aceita
presenca        — id, colaboradorId, diarioId, presente
```

---

## O que já está 100% implementado

- ✅ Auth completa (login, registro, logout, roles, JWT)
- ✅ CRUD de obras com filtro, busca e progresso
- ✅ Diário de obra com todas as abas (clima, atividades, mão de obra, equipamentos, ocorrências, fotos)
- ✅ Seletor de equipes e operários com presença (MaoDeObraSelector reescrito)
- ✅ Visualização e edição de diário
- ✅ Equipes e colaboradores (CRUD)
- ✅ Materiais e movimentações
- ✅ Pendências com criticidade e prazo
- ✅ Resumos periódicos com IA (semanal/quinzenal/mensal)
- ✅ Export PDF de diário individual (window.print)
- ✅ Export PDF de período (exportPeriodoPDF)
- ✅ Export Excel de diários e resumos (SheetJS)
- ✅ Painel do cliente (somente leitura)
- ✅ Admin panel (gestão de usuários)
- ✅ Dashboard com gráficos (Recharts)

---

## O que ainda falta implementar (por prioridade)

### P1 — Para rodar em produção
- [ ] **Responsividade mobile** — tabelas com scroll horizontal, sidebar como drawer em mobile, forms adaptados
- [ ] **Upload de fotos real** — hoje o componente existe mas não persiste (falta integrar storage: S3, Supabase ou Cloudinary)
- [ ] **Variáveis de ambiente de produção** — configurar para deploy (Railway, Render ou VPS)

### P2 — Funcionalidades importantes
- [ ] **Link compartilhável para cliente** — gerar token temporário (já existe tabela `acessoCliente`), rota pública `/c/:token`
- [ ] **Assinatura digital** — canvas para assinar no browser (engenheiro, encarregado, cliente)
- [ ] **API de clima automática** — preencher clima/temperatura automaticamente via OpenWeatherMap ao abrir o formulário de diário

### P3 — Diferenciais
- [ ] **Notificações por email** — envio automático de resumo semanal via SMTP (nodemailer)
- [ ] **PDF profissional** — capa, logo da empresa, paginação automática (considerar puppeteer ou @react-pdf/renderer)
- [ ] **Geolocalização** — registrar coordenadas do lançamento do diário

---

## Convenções do projeto

- Routers tRPC: `publicProcedure` para rotas abertas, `protectedProcedure` para autenticadas, `engineerProcedure` para eng+admin, `adminProcedure` para admin
- Sempre usar `toast.success()` / `toast.error()` para feedback ao usuário (sonner)
- Formulários com `useState` simples (sem react-hook-form nas telas principais)
- Navegação com `wouter` (`useLocation`, `useRoute`)
- Queries: `trpc.*.useQuery()` | Mutações: `trpc.*.useMutation()`
- Invalidar cache após mutação: `trpc.useUtils().*.invalidate()`
- Estilos: Tailwind + variáveis CSS do shadcn/ui (nunca hardcodar cores)
- Componentes shadcn/ui em `@/components/ui/*`

---

## Como rodar localmente

```bash
# Pré-requisitos: Node 20+, pnpm, MySQL 8

# 1. Dependências
pnpm install

# 2. Configurar .env (copiar .env.example e preencher)
cp .env.example .env

# 3. Criar tabelas
pnpm db:push

# 4. Desenvolvimento
pnpm dev
# Acesse http://localhost:3000
# Clique em "Criar conta" para registrar o primeiro usuário
# Para virar admin: UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

---

## Como fazer deploy (Railway — recomendado)

```bash
# 1. Criar conta em railway.app
# 2. Novo projeto > Deploy from GitHub
# 3. Adicionar serviço MySQL no mesmo projeto
# 4. Configurar variáveis de ambiente no Railway:
#    DATABASE_URL  = (gerado pelo Railway automaticamente)
#    JWT_SECRET    = (string longa aleatória)
#    NODE_ENV      = production
#    OPENAI_API_KEY = (opcional)
# 5. O Railway detecta pnpm e roda `pnpm build` + `pnpm start` automaticamente
```

---

## Instruções para o Claude Code

Quando o usuário pedir alterações:

1. **Sempre mostre o preview** das mudanças antes de aplicar quando possível
2. **Nunca quebre auth** — protectedProcedure nos endpoints que precisam de login
3. **Mantenha o padrão tRPC** — não introduza fetch/axios direto no frontend
4. **Ao adicionar tabela nova** — atualize `drizzle/schema.ts` e rode `pnpm db:push`
5. **Ao adicionar rota nova** — adicione em `server/routers.ts` e exporte o tipo via `AppRouter`
6. **Teste no browser** antes de dizer que está pronto
7. **Commits pequenos e descritivos** em português

