# Elsehu Atendimento Backend

Backend em NestJS para o SaaS de atendimento omnichannel (WhatsApp Oficial Cloud API + Evolution API). O projeto já nasce dockerizado, com Postgres, Redis, Prisma ORM e uma fundação de segurança baseada em JWT, rate limiting e separação de perfis (Operador, Supervisor, Administrador).

## Stack Principal

- **NestJS 11** (HTTP + WebSocket previstos)
- **Prisma ORM** + Postgres 15
- **Redis 7** + BullMQ (para campanhas e filas de disparo)
- **JWT (access/refresh)** com `@nestjs/jwt`
- **Helmet + Throttler** para hardening

## Pré‑requisitos

- Node.js 22+
- Docker / Docker Compose
- `npm` 10+

## Configuração Rápida

1. Instale dependências:

   ```bash
   npm install
   ```

2. Crie seu arquivo de variáveis:

   ```bash
   cp env.example .env
   ```

   Ajuste segredos de JWT, credenciais do Postgres/Redis, `STORAGE_PATH`
   (diretório local usado para salvar uploads como CSV de contatos) e
   origens de CORS.

3. Suba os serviços base:

   ```bash
   docker compose up -d postgres redis
   ```

4. Execute migrations (a serem adicionadas) e gere o cliente Prisma:

   ```bash
   npx prisma db push
   ```

5. Rode o seed para criar o primeiro administrador:

   ```bash
   npm run db:seed
   ```

6. Inicie a API:

   ```bash
   npm run start:dev
   ```

## Docker completo (API + Postgres + Redis)

```bash
docker compose up --build
```

A aplicação usa o alvo `development` do Dockerfile para hot reload. Para produção basta construir `docker build -t elsehu-api .` e rodar o container (modo `production`).

### Deploy local em modo produção

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Esse arquivo usa:

- estágio `production` do Dockerfile (apenas `dist/` e deps necessárias);
- volumes nomeados para Postgres/Redis/`storage` (CSV importados);
- variáveis carregadas de `.env` + overrides internos (`DATABASE_URL` apontando para o serviço `postgres`).

Antes do primeiro start em produção execute as migrations/seed:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Scripts úteis

- `npm run db:seed` – cria/garante o usuário administrador inicial.
- `npm run db:migrate` – aplica migrations em ambiente de desenvolvimento.
- `npm run db:deploy` – aplica migrations em produção (`prisma migrate deploy`).
- `npm run db:generate` – regenera o cliente Prisma.
- `npm run lint` – verificação com ESLint + Prettier.
- `npm run test` / `npm run test:e2e` – base para testes unitários e e2e.

## Estrutura de Módulos

- `src/auth` – Sistema completo de autenticação JWT (access/refresh tokens).
- `src/users` – CRUD de usuários com controle de perfis (ADMIN, SUPERVISOR, OPERATOR).
- `src/contacts` – CRUD de contatos + importação em massa via CSV.
- `src/service-instances` – Gerenciamento de instâncias WhatsApp (Meta/Evolution).
- `src/templates` – Templates de mensagens para campanhas.
- `src/tabulations` – Tabulações para categorização de atendimentos.
- `src/conversations` – Gestão de conversas (abertura, atribuição, fechamento).
- `src/messages` – Envio e histórico de mensagens.
- `src/websockets` – Gateway WebSocket para chat em tempo real.
- `src/webhooks` – Recebimento de webhooks Meta/Evolution.
- `src/campaigns` – Campanhas de disparo em massa com BullMQ.
- `src/reports` – Relatórios e estatísticas de atendimento.
- `src/logger` – Sistema de logging estruturado com Winston.
- `src/storage` – Gerenciamento de arquivos (CSV, uploads).
- `src/prisma` – Provider global do Prisma ORM.
- `src/common` – Decorators, DTOs, enums e guards reutilizáveis.
- `docs/API_ENDPOINTS.md` – Documentação completa de todos os endpoints.

## Funcionalidades Implementadas

✅ **Autenticação & Autorização**
- JWT com access e refresh tokens
- Guards globais para proteção de rotas
- Sistema de roles (ADMIN, SUPERVISOR, OPERATOR)

✅ **Gestão de Contatos**
- CRUD completo
- Importação em massa via CSV
- Normalização de telefones (formato E.164)
- Busca textual e paginação

✅ **Atendimento Omnichannel**
- Múltiplas instâncias WhatsApp (Meta Oficial + Evolution API)
- Conversas em tempo real via WebSocket
- **Sistema de atribuição automática inteligente**
- **Operadores online/offline**
- **Distribuição baseada em tempo de inatividade**
- **Expiração automática de conversas (24h)**
- **Isolamento: operador só vê suas conversas**
- Fila de espera
- Fechamento com tabulação

✅ **Mensagens**
- Envio manual via API ou WebSocket
- Recebimento automático via webhooks
- Histórico completo
- Status de entrega

✅ **Campanhas de Disparo**
- Upload de CSV com contatos
- Processamento assíncrono com BullMQ
- Controle de velocidade (delay configurável)
- Pausar/retomar campanhas
- Estatísticas em tempo real

✅ **Relatórios & Analytics**
- Conversas finalizadas com filtros
- Export para CSV
- Estatísticas gerais (TMA, TME, duração)
- Performance por operador
- Distribuição por tabulação

✅ **Infraestrutura**
- Dockerizado (dev + prod)
- Redis para cache e filas
- PostgreSQL com Prisma ORM
- Logging estruturado (Winston)
- Rate limiting e segurança (Helmet)
- Health checks

## Próximos passos

- Integrar APIs reais da Meta e Evolution (atualmente simulado).
- Implementar suporte a mensagens de mídia (imagem, áudio, vídeo, documento).
- Adicionar testes automatizados (Jest + Supertest).
- Implementar sistema de métricas (Prometheus).
- Adicionar APM para monitoramento de performance.
