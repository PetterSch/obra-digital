# Obra Digital — Diário de Obras Profissional

Sistema completo de diário de obras com autenticação própria, gestão de equipes, materiais, pendências, relatórios PDF/Excel e resumos executivos com IA.

---

## Stack

- **Frontend:** React 19 · Vite · TypeScript · TailwindCSS · Shadcn/UI
- **Backend:** Node.js · Express · tRPC
- **Banco:** MySQL 8 · Drizzle ORM
- **Auth:** JWT próprio (email + senha + bcrypt)
- **IA:** OpenAI GPT (opcional)

---

## Pré-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- MySQL 8 (local ou em nuvem)

---

## Instalação

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com sua DATABASE_URL e JWT_SECRET

# 3. Criar as tabelas no banco
pnpm db:push

# 4. Iniciar em desenvolvimento
pnpm dev
```

Acesse em **http://localhost:3000**

---

## Primeiro acesso

Na tela de login, clique em **"Criar conta"** para registrar o primeiro usuário (será criado com perfil Engenheiro).

Para promover a admin, atualize diretamente no banco:
```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

---

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Inicia o build de produção |
| `pnpm db:push` | Aplica migrations no banco |

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string MySQL |
| `JWT_SECRET` | ✅ | Chave de assinatura JWT |
| `OPENAI_API_KEY` | ❌ | Habilita resumos com IA |
| `OPENAI_MODEL` | ❌ | Modelo OpenAI (padrão: gpt-4o-mini) |
| `VITE_GOOGLE_MAPS_API_KEY` | ❌ | Habilita mapa da obra |
| `PORT` | ❌ | Porta do servidor (padrão: 3000) |

---

## Módulos

- **Dashboard** — visão geral de obras, progresso e alertas
- **Obras** — CRUD completo com filtros e progresso
- **Diário de obra** — registro diário com clima, atividades, mão de obra, equipamentos, ocorrências e fotos
- **Equipes** — gestão de equipes e operários com presença por dia
- **Materiais** — controle de estoque e movimentações
- **Pendências** — ocorrências com criticidade e prazo
- **Relatórios** — export PDF e Excel por período
- **Resumos com IA** — resumo executivo semanal/mensal via OpenAI
- **Painel do cliente** — visão somente leitura para clientes
- **Admin** — gestão de usuários e permissões

---

## Perfis de acesso

| Perfil | Permissões |
|---|---|
| `admin` | Acesso total, gestão de usuários |
| `engenheiro` | Cria obras, registra diários, gera relatórios |
| `cliente` | Somente leitura (painel do cliente) |
