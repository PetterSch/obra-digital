# Obra Digital - Database Schema Documentation

## Overview

This document describes the database schema for Obra Digital, a construction project management platform. The database uses MySQL/TiDB with Drizzle ORM for type-safe database access.

## Database Tables

### users
Stores user account information and authentication details.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | User ID |
| openId | string (UNIQUE) | Manus OAuth OpenID |
| name | string | User full name |
| email | string | User email address |
| loginMethod | string | Login method (oauth, password, etc.) |
| role | enum | User role: admin, engenheiro, cliente |
| lastSignedIn | Date | Last login timestamp |
| createdAt | Date | Account creation date |

**Relationships:**
- One user can create multiple obras
- One user can create multiple diários
- One user can create multiple equipes

---

### obras
Stores construction project information.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Project ID |
| codigo | string (UNIQUE) | Project code/identifier |
| nome | string | Project name |
| cliente | string | Client name |
| endereco | string | Project address |
| cidade | string | City |
| estado | string | State (UF) |
| cep | string | Postal code |
| responsavelTecnico | string | Technical responsible person |
| crea | string | Professional registration (CREA) |
| dataInicio | Date | Project start date |
| dataPrevistTermino | Date | Expected end date |
| status | enum | Status: planejamento, em_andamento, pausada, finalizada, cancelada |
| percentualAndamento | number | Completion percentage (0-100) |
| criadoPor | number (FK) | User ID who created the project |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many diários belong to one obra
- Many atividades belong to one obra
- Many ocorrências belong to one obra
- Many equipamentos belong to one obra
- Many materiais belong to one obra
- Many pendências belong to one obra
- Many acessoObra records for one obra

---

### diarios
Stores daily work diary entries.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Diary entry ID |
| obraId | number (FK) | Associated project |
| data | Date | Date of the work |
| responsavel | number (FK) | User who created entry |
| clima | enum | Weather: ensolarado, nublado, chuvoso, tempestuoso |
| temperatura | string | Temperature in Celsius |
| umidade | number | Humidity percentage |
| observacoesGerais | text | General observations |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many atividades belong to one diário
- Many ocorrências belong to one diário
- Many equipamentos belong to one diário
- Many materiais belong to one diário
- Many midia (photos) belong to one diário
- Many presenca records for one diário
- Many sugestoesLLM belong to one diário

---

### atividades
Records activities performed during work.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Activity ID |
| diarioId | number (FK) | Associated diary entry |
| obraId | number (FK) | Associated project |
| descricao | string | Activity description |
| local | string | Location/area |
| status | enum | Status: nao_iniciada, em_andamento, concluida |
| percentualConcluido | number | Completion percentage |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many atividades belong to one diário
- Many atividades belong to one obra

---

### ocorrencias
Records incidents and issues during work.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Incident ID |
| diarioId | number (FK) | Associated diary entry |
| obraId | number (FK) | Associated project |
| tipo | enum | Type: atraso, acidente, problema_qualidade, outro |
| descricao | string | Incident description |
| impacto | string | Impact assessment |
| status | enum | Status: aberta, resolvida |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many ocorrências belong to one diário
- Many ocorrências belong to one obra

---

### equipamentos
Records equipment usage and availability.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Equipment ID |
| diarioId | number (FK) | Associated diary entry |
| obraId | number (FK) | Associated project |
| nome | string | Equipment name |
| tipo | string | Equipment type |
| horasUtilizacao | number | Hours of operation |
| observacoes | string | Notes |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many equipamentos belong to one diário
- Many equipamentos belong to one obra

---

### materiais
Records materials used or delivered.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Material ID |
| diarioId | number (FK) | Associated diary entry |
| obraId | number (FK) | Associated project |
| nome | string | Material name |
| quantidade | number | Quantity |
| unidade | string | Unit (m³, kg, unidade, etc.) |
| observacoes | string | Notes |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many materiais belong to one diário
- Many materiais belong to one obra

---

### movimentacaoMateriais
Tracks material movement/inventory.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Movement ID |
| materialId | number (FK) | Associated material |
| tipo | enum | Type: entrada, saida |
| quantidade | number | Quantity moved |
| data | Date | Movement date |
| observacoes | string | Notes |

**Relationships:**
- Many movimentações belong to one material

---

### midia
Stores photo and media references.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Media ID |
| diarioId | number (FK) | Associated diary entry |
| url | string | Storage URL (/manus-storage/...) |
| descricao | string | Photo description |
| dataTirada | Date | Date photo was taken |
| criadoEm | Date | Upload timestamp |

**Relationships:**
- Many midia belong to one diário

---

### equipes
Stores work team information.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Team ID |
| nome | string | Team name |
| empresa | string | Company name |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many colaboradores belong to one equipe
- Many presenca records reference one equipe

---

### colaboradores
Stores team member information.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Collaborator ID |
| equipeId | number (FK) | Associated team |
| nome | string | Full name |
| cpf | string | Tax ID |
| funcao | string | Job role |
| dataAdmissao | Date | Hire date |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many colaboradores belong to one equipe
- Many presenca records for one colaborador

---

### presenca
Tracks team member attendance in diários.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Presence record ID |
| colaboradorId | number (FK) | Associated collaborator |
| diarioId | number (FK) | Associated diary entry |
| equipeId | number (FK) | Associated team |
| data | Date | Date of presence |
| presente | boolean | Attendance status |
| horarioChegada | string | Arrival time |
| horarioSaida | string | Departure time |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many presenca records for one colaborador
- Many presenca records for one diário
- Many presenca records for one equipe

---

### sugestoesLLM
Stores AI-generated suggestions for diários.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Suggestion ID |
| diarioId | number (FK) | Associated diary entry |
| tipo | enum | Type: resumo_diario, descricao_atividade, analise_ocorrencia |
| sugestao | text | Generated suggestion text |
| aprovada | boolean | Approval status |
| textoFinal | text | Final approved text |
| criadoEm | Date | Generation timestamp |

**Relationships:**
- Many sugestoesLLM belong to one diário

---

### pendencias
Tracks pending tasks and issues.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Pending item ID |
| obraId | number (FK) | Associated project |
| descricao | string | Description |
| status | enum | Status: aberta, resolvida |
| prioridade | enum | Priority: baixa, media, alta |
| dataVencimento | Date | Due date |
| responsavel | number (FK) | Assigned user |
| criadoEm | Date | Creation timestamp |

**Relationships:**
- Many pendências belong to one obra

---

### relatorios
Stores generated reports.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Report ID |
| obraId | number (FK) | Associated project |
| tipo | enum | Type: semanal, quinzenal, mensal |
| dataInicio | Date | Period start date |
| dataFim | Date | Period end date |
| conteudo | text | Report content (JSON) |
| geradoEm | Date | Generation timestamp |

**Relationships:**
- Many relatórios belong to one obra

---

### acessoCliente
Tracks client access to projects.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Access record ID |
| clienteId | number (FK) | Client user ID |
| obraId | number (FK) | Associated project |
| dataAcesso | Date | Last access date |
| permissoes | string | JSON permissions |

**Relationships:**
- Many acessoCliente for one obra
- Many acessoCliente for one user (cliente)

---

### acessoObra
Tracks obra access and permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | number (PK) | Access record ID |
| usuarioId | number (FK) | User ID |
| obraId | number (FK) | Associated project |
| role | enum | Role: admin, engenheiro, cliente |
| dataAcesso | Date | Last access date |

**Relationships:**
- Many acessoObra for one obra

---

## Entity Relationships

### Hierarchy

```
users
├── obras (criadoPor)
│   ├── diarios
│   │   ├── atividades
│   │   ├── ocorrencias
│   │   ├── equipamentos
│   │   ├── materiais
│   │   ├── midia
│   │   ├── presenca
│   │   │   ├── colaboradores
│   │   │   │   └── equipes
│   │   │   └── equipes
│   │   └── sugestoesLLM
│   ├── pendencias
│   ├── relatorios
│   ├── acessoCliente
│   └── acessoObra
├── equipes
│   └── colaboradores
│       └── presenca
└── pendencias (responsavel)
```

## Indexes

For performance optimization, the following indexes are recommended:

- `diarios.obraId` - Frequent filtering by project
- `diarios.data` - Date range queries for consolidation
- `presenca.diarioId` - Attendance lookups
- `presenca.colaboradorId` - Team member history
- `sugestoesLLM.diarioId` - Suggestion retrieval
- `materiais.obraId` - Material tracking
- `equipamentos.obraId` - Equipment tracking

## Data Types

- **number**: Integer (32-bit)
- **string**: VARCHAR (255 default)
- **text**: LONGTEXT for large content
- **Date**: DATETIME with timezone
- **enum**: VARCHAR with predefined values
- **boolean**: TINYINT(1) (0 or 1)

## Constraints

- All foreign keys use CASCADE on delete where appropriate
- Unique constraints on `users.openId` and `obras.codigo`
- NOT NULL constraints on required fields
- Date constraints ensure dataInicio < dataPrevistTermino

## Backup & Recovery

- Daily automated backups
- Point-in-time recovery available
- Backup retention: 30 days

## Migration Management

Database migrations are managed with Drizzle Kit:

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate
```

---

**Last Updated:** May 2026
**Version:** 1.0
