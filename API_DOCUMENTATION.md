# Obra Digital - API Documentation

## Overview

Obra Digital is a comprehensive construction project management platform with digital work diary, team management, and AI-powered reporting. This document describes the tRPC API endpoints and their usage.

## Authentication

All endpoints require authentication via Manus OAuth. The session cookie is automatically managed by the framework.

### User Roles

- **admin**: Full access to all features
- **engenheiro**: Can create/edit diários, manage teams, view reports
- **cliente**: Read-only access to resumos and diários

## API Endpoints

### Obras (Projects)

#### `obras.list`
List all obras accessible to the user.

**Query Parameters:**
- None

**Response:**
```typescript
{
  id: number;
  codigo: string;
  nome: string;
  cliente: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  responsavelTecnico: string;
  crea: string;
  dataInicio: Date;
  dataPrevistTermino: Date;
  status: "planejamento" | "em_andamento" | "pausada" | "finalizada" | "cancelada";
  percentualAndamento: number;
  criadoPor: number;
  criadoEm: Date;
}[]
```

#### `obras.getById`
Get a specific obra by ID.

**Input:**
```typescript
{ id: number }
```

**Response:**
```typescript
{
  id: number;
  codigo: string;
  nome: string;
  // ... (same fields as list)
}
```

#### `obras.create`
Create a new obra (admin/engenheiro only).

**Input:**
```typescript
{
  codigo: string;
  nome: string;
  cliente: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  responsavelTecnico: string;
  crea: string;
  dataInicio: Date;
  dataPrevistTermino: Date;
}
```

**Response:** Created obra object

#### `obras.update`
Update an existing obra (admin/engenheiro only).

**Input:**
```typescript
{
  id: number;
  // ... (partial fields to update)
}
```

**Response:** Updated obra object

### Diários (Work Diaries)

#### `diarios.listByObra`
List all diários for a specific obra.

**Input:**
```typescript
{ obraId: number }
```

**Response:** Array of diário objects

#### `diarios.getById`
Get a specific diário by ID.

**Input:**
```typescript
{ id: number }
```

**Response:** Diário object with related data

#### `diarios.create`
Create a new diário (engenheiro only).

**Input:**
```typescript
{
  obraId: number;
  data: Date;
  responsavel: number;
  clima: "ensolarado" | "nublado" | "chuvoso" | "tempestuoso";
  temperatura: string;
  umidade: number;
  observacoesGerais: string;
  maoDeObra?: {
    equipeId: number;
    colaboradores: number[];
  }[];
}
```

**Response:** Created diário object

### Consolidação (Consolidation)

#### `consolidacao.getPeriodo`
Get consolidated data for a specific period.

**Input:**
```typescript
{
  obraId: number;
  dataInicio: string; // ISO date
  dataFim: string;    // ISO date
}
```

**Response:**
```typescript
{
  totalDiarios: number;
  totalAtividades: number;
  totalOcorrencias: number;
  totalFotos: number;
  principaisAtividades: string[];
  principaisOcorrencias: string[];
  climaPredominate: string;
  maoDeObraTotal: number;
  equipamentosUtilizados: string[];
  materiaisMovimentados: any[];
}
```

#### `consolidacao.gerarResumoLLM`
Generate an AI-powered narrative summary for a period.

**Input:**
```typescript
{
  obraId: number;
  dataInicio: string;
  dataFim: string;
}
```

**Response:**
```typescript
{
  resumo: string; // Markdown formatted narrative
  consolidacao: { /* consolidation data */ };
}
```

#### `consolidacao.getMidias`
Get photos/media for a period.

**Input:**
```typescript
{
  obraId: number;
  dataInicio: string;
  dataFim: string;
}
```

**Response:** Array of media objects with URLs

### Equipes (Teams)

#### `equipes.list`
List all teams.

**Response:** Array of team objects

#### `equipes.create`
Create a new team (engenheiro only).

**Input:**
```typescript
{
  nome: string;
  empresa: string;
}
```

**Response:** Created team object

#### `equipes.update`
Update a team (engenheiro only).

**Input:**
```typescript
{
  id: number;
  nome?: string;
  empresa?: string;
}
```

**Response:** Updated team object

#### `equipes.delete`
Delete a team (admin only).

**Input:**
```typescript
{ id: number }
```

### Colaboradores (Collaborators)

#### `colaboradores.listByEquipe`
List all collaborators in a team.

**Input:**
```typescript
{ equipeId: number }
```

**Response:** Array of collaborator objects

#### `colaboradores.create`
Add a collaborator to a team.

**Input:**
```typescript
{
  equipeId: number;
  nome: string;
  cpf: string;
  funcao: string;
  dataAdmissao: Date;
}
```

**Response:** Created collaborator object

#### `colaboradores.update`
Update collaborator information.

**Input:**
```typescript
{
  id: number;
  // ... (partial fields to update)
}
```

**Response:** Updated collaborator object

#### `colaboradores.delete`
Remove a collaborator (admin only).

**Input:**
```typescript
{ id: number }
```

### Sugestões LLM (LLM Suggestions)

#### `sugestoesLLM.list`
List LLM suggestions with optional filtering.

**Input:**
```typescript
{
  aprovada?: boolean;
}
```

**Response:** Array of suggestion objects

#### `sugestoesLLM.getById`
Get a specific suggestion.

**Input:**
```typescript
{ id: number }
```

**Response:** Suggestion object

#### `sugestoesLLM.aprovar`
Approve a suggestion and apply it to the diário.

**Input:**
```typescript
{
  id: number;
  textoFinal?: string; // Optional override
}
```

**Response:** Updated suggestion object

#### `sugestoesLLM.rejeitar`
Reject and delete a suggestion.

**Input:**
```typescript
{ id: number }
```

### System

#### `auth.me`
Get current user information.

**Response:**
```typescript
{
  id: number;
  name: string;
  email: string;
  role: "admin" | "engenheiro" | "cliente";
}
```

#### `auth.logout`
Logout the current user.

**Response:** `{ success: boolean }`

#### `system.notifyOwner`
Send a notification to the project owner (protected).

**Input:**
```typescript
{
  title: string;
  content: string;
}
```

**Response:** `{ success: boolean }`

## Error Handling

All endpoints return standard tRPC error responses:

```typescript
{
  code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR";
  message: string;
}
```

### Common Status Codes

- **UNAUTHORIZED**: User is not authenticated
- **FORBIDDEN**: User lacks required permissions
- **NOT_FOUND**: Resource not found
- **BAD_REQUEST**: Invalid input data
- **INTERNAL_SERVER_ERROR**: Server error

## Usage Examples

### Create a Work Diary

```typescript
const diario = await trpc.diarios.create.mutate({
  obraId: 1,
  data: new Date("2026-01-15"),
  responsavel: userId,
  clima: "ensolarado",
  temperatura: "28.5",
  umidade: 65,
  observacoesGerais: "Dia produtivo",
  maoDeObra: [
    {
      equipeId: 1,
      colaboradores: [1, 2, 3],
    },
  ],
});
```

### Generate Consolidation Report

```typescript
const report = await trpc.consolidacao.getPeriodo.query({
  obraId: 1,
  dataInicio: "2026-01-01",
  dataFim: "2026-01-31",
});

const withNarrative = await trpc.consolidacao.gerarResumoLLM.query({
  obraId: 1,
  dataInicio: "2026-01-01",
  dataFim: "2026-01-31",
});
```

### Manage Teams

```typescript
// Create team
const team = await trpc.equipes.create.mutate({
  nome: "Equipe Estrutura",
  empresa: "Construtora ABC",
});

// Add collaborator
const collab = await trpc.colaboradores.create.mutate({
  equipeId: team.id,
  nome: "João Silva",
  cpf: "123.456.789-00",
  funcao: "pedreiro",
  dataAdmissao: new Date(),
});
```

## Rate Limiting

No explicit rate limiting is implemented. The platform uses standard HTTP timeouts (180 seconds).

## Versioning

This API is version 1.0. Future versions will maintain backward compatibility when possible.

## Support

For API issues or questions, contact the development team or submit an issue in the project repository.
