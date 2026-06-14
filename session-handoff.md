# Transferência de Sessão — Deploy do Obra Digital no VPS Hostinger + migração do Railway

**Gerado em:** 2026-06-13T16:40:00Z
**Arquivo salvo em:** /Users/pedroemilio/Downloads/obra-digital-completo/session-handoff.md

## Ponto de partida

O usuário queria hospedar o sistema Obra Digital (Node.js + MySQL + React) em um VPS da Hostinger KVM1, migrando todos os dados do Railway (banco antigo) para o novo servidor. O objetivo era manter todos os logins e dados existentes.

## Decisões tomadas e o que foi entregue

- **VPS provisionado:** IP `212.85.22.31`, Ubuntu 25.10, Hostinger KVM1
- **Stack instalada no VPS:** Node.js 20, pnpm, PM2, Nginx, MySQL 8.4.9
- **Banco criado:** `obra_digital` com usuário `obra_user` / senha `ObraDigital@2025`
- **Projeto clonado:** `https://github.com/PetterSch/obra-digital` em `/var/www/obra-digital`
- **Arquivo .env criado:** `/var/www/obra-digital/.env` com DATABASE_URL, JWT_SECRET, PORT=3000, NODE_ENV=production
- **Build feito:** `pnpm install && pnpm build` executado com sucesso
- **Tabelas criadas:** `pnpm db:push` criou 21 tabelas no banco
- **PM2 configurado:** app `obra-digital` rodando em modo fork, autostart habilitado (`pm2 startup` + `pm2 save`)
- **Nginx configurado:** `/etc/nginx/sites-available/obra-digital` como proxy reverso para `localhost:3000`
- **Dados migrados:** banco exportado do Railway via `mysqldump` e importado no VPS — todos os usuários, obras, diários preservados
- **DNS configurado:** registro A `@` do domínio `obradigital.cloud` apontando para `212.85.22.31` na Hostinger

## Arquivos-chave para a próxima sessão

- `/var/www/obra-digital/.env` — variáveis de ambiente de produção (no VPS)
- `/etc/nginx/sites-available/obra-digital` — config Nginx atual (no VPS)
- `/Users/pedroemilio/Downloads/obra-digital-completo/CONTEXTO.md` — contexto completo do projeto
- `/Users/pedroemilio/Downloads/obra-digital-completo/server/routers.ts` — todos os endpoints tRPC

## Contexto web e integrações externas

### Sites acessados

- `hpanel.hostinger.com` — configuração de DNS do domínio `obradigital.cloud`: registro A `@` editado para `212.85.22.31`, CNAME `www` já existia apontando para `obradigital.cloud` — estado atual: DNS salvo, propagação em andamento
- `railway.app` — Railway CLI autenticado como `pedro@rcengenharia.com.br`, projeto `valiant-ambition` (environment: production, serviço MySQL) — banco exportado com sucesso

### Uploads e envios realizados

- `~/obra_backup.sql` (1672KB) → `root@212.85.22.31:/root/obra_backup.sql` via scp — importado com sucesso no banco `obra_digital` do VPS

### Credenciais e autenticações usadas

- **VPS SSH:** `root@212.85.22.31` — senha definida pelo usuário no hPanel da Hostinger — ativa
- **MySQL VPS:** usuário `obra_user`, senha `ObraDigital@2025`, banco `obra_digital`
- **JWT_SECRET VPS:** `e20d890d6920bd5a85a4aab28364e80e0607af280e5aea978f64fe0b269a310d15ba8287270f6678ad4f6fb27a97349afc3dfdd57f66ef3c413fc28f2a05c8e2`
- **Railway CLI:** autenticado como `pedro@rcengenharia.com.br` — sessão ativa no Mac
- **Railway MySQL:** host `zephyr.proxy.rlwy.net`, porta `13889`, usuário `root`, senha `RkVIIxZfszjZcyUQkbBkzdMhYIcdfZTp`, banco `railway`

### APIs e integrações

- `mysqldump` → Railway MySQL público (`zephyr.proxy.rlwy.net:13889`) — exportou banco completo para `~/obra_backup.sql`
- MySQL import no VPS — 21 tabelas + dados migrados com sucesso

## Estado atual

- **Processos em background:** PM2 rodando `obra-digital` (id 0) em `/var/www/obra-digital` — porta 3000 — para parar: `pm2 stop obra-digital` no VPS
- **Servidores / portas:** Nginx na porta 80 fazendo proxy para Node.js na porta 3000 — acessível em `http://212.85.22.31` e em breve em `http://obradigital.cloud`
- **Worktrees / branches abertas:** nenhum

## Verificação

- `ssh root@212.85.22.31` → `pm2 status` — deve mostrar `obra-digital` online
- `http://212.85.22.31` — deve abrir o login do Obra Digital
- `http://obradigital.cloud` — deve funcionar após propagação DNS (pode levar até 24h, geralmente minutos)
- Login com credenciais antigas do Railway deve funcionar

## Pendências e perguntas abertas

- **Pendente: Nginx atualizado para domínio** — o último comando enviado ao usuário foi atualizar o Nginx para `server_name obradigital.cloud www.obradigital.cloud` e recarregar — não foi confirmado se foi executado ainda
- **Pendente: HTTPS / SSL** — após Nginx com domínio configurado, instalar Certbot: `apt install -y certbot python3-certbot-nginx && certbot --nginx -d obradigital.cloud -d www.obradigital.cloud`
- **Pendente: Cancelar Railway** — usuário pode cancelar o plano do Railway agora que dados foram migrados
- **Em aberto: Backup automático** — usuário manifestou interesse mas não foi implementado

## Por onde continuar

Confirmar no VPS se o Nginx já foi atualizado para o domínio (`cat /etc/nginx/sites-available/obra-digital`) e, se sim, instalar o HTTPS com Certbot: `apt install -y certbot python3-certbot-nginx && certbot --nginx -d obradigital.cloud -d www.obradigital.cloud`.
