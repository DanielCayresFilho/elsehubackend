# Elsehu Backend – Visão Resumida Completa

## 1. Propósito da API

Plataforma SaaS para atendimento via WhatsApp com múltiplos operadores. O backend (NestJS 11) orquestra:
- Autenticação/Autorização (JWT + Roles)
- Conexão com provedores WhatsApp (Evolution API e futura Meta Oficial)
- Gestão de contatos, conversas, mensagens e campanhas
- Atualização em tempo real via WebSocket e ingestão de eventos via Webhooks
- Relatórios operacionais, tabulações e storage de mídias

---

## 2. Stack Técnica

- **Runtime:** Node.js 22+, NestJS 11 (HTTP + WebSocket)
- **Banco:** PostgreSQL 15 com Prisma ORM
- **Filas/Cache:** Redis 7 + BullMQ (campanhas)
- **Autenticação:** JWT (access/refresh) com guards globais
- **Segurança:** Helmet, rate limiting (Throttler), CORS configurável
- **Observabilidade:** Winston estruturado + middleware HTTP logger
- **Infra:** Docker/Docker Compose (dev e prod), env via `.env`

---

## 3. Arquitetura Modular

| Módulo                         | Responsabilidade principal |
|-------------------------------|----------------------------|
| `auth`                        | Login, refresh, guards JWT |
| `users`                       | CRUD usuários + papéis     |
| `contacts`                    | CRUD/import CSV com normalização E.164 |
| `service-instances`           | Instâncias Evolution/Meta (phone, ativação, QR Code/webhook Base64) |
| `conversations`               | Abertura/atribuição/fechamento com tabulação |
| `messages`                    | Envio/recebimento, status, mídias |
| `websockets` (`chat.gateway`) | Eventos `conversation:*`, `message:*` |
| `webhooks`                    | Entrada Evolution/Meta para mensagens/status |
| `campaigns`                   | Disparos em massa com BullMQ |
| `templates`                   | Mensagens pré-aprovadas para campanhas |
| `tabulations`                 | Motivos de encerramento e relatórios |
| `reports`                     | KPIs (TME/TMA, volume, operadores) |
| `storage`                     | Persistência local (`storage/`) de CSV/mídia |
| `scheduler`                   | Limpeza de mídias expiradas, rotinas periódicas |
| `common`                      | Decorators (`@Roles`, `@CurrentUser`), DTOs, enums |
| `logger`                      | Middleware + provider Winston |
| `prisma`                      | Provider global + seed/migrations |

---

## 4. Fluxos Centrais

### 4.1 Autenticação / Segurança
1. Login (`POST /api/auth/login`) → retorna `accessToken` (15 min) e `refreshToken`.
2. Guards `JwtAccessGuard`/`JwtRefreshGuard` protegem rotas.
3. Decorator `@Roles` valida perfis (`ADMIN`, `SUPERVISOR`, `OPERATOR`).
4. Middleware Helmet + throttler previne abuso; logs auditam cada request.

### 4.2 Instâncias Evolution/Meta
1. `POST /api/service-instances` gera registro no banco exigindo `name`, `phone`, `provider` e `credentials`.
2. Para Evolution:
   - Cria instância via `POST {serverUrl}/instance/create`.
   - Configura webhook `.../webhook/set/{instance}` com eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE` **e `webhook_base64: true`** para garantir entrega de mídias mesmo sem URL pública.
   - Disponibiliza `GET /api/service-instances/:id/qrcode` para conectividade (retorna base64 ou pairing code).
3. Flag `isActive` controla disponibilidade:
   - `GET /api/service-instances` retorna apenas ativos por padrão (`?includeInactive=true` para listar todos).
   - `DELETE /api/service-instances/:id` apenas desativa (`isActive=false`) em vez de remover registros.
   - Operações dependentes (conversas, mensagens, campanhas) verificam `isActive` antes de prosseguir.

### 4.3 Conversas e Mensagens
1. **Conversas**
   - Criadas via `POST /api/conversations` apontando `contactId` + `serviceInstanceId`.
   - Validam contato existente, instância ativa e unicidade de conversa aberta.
   - Suportam fila, atribuição manual/automática e fechamento com tabulação.
2. **Mensagens Outbound**
   - Endpoint `POST /api/messages/send` ou WebSocket `message:send`.
   - Garante que a instância da conversa esteja ativa, cria registro `pending` e envia conforme provedor:
     - **Evolution:** `POST /message/sendText/{instanceName}` com header `apikey`.
     - **Meta Cloud:** envia via Graph API (`/{version}/{phoneId}/messages`) usando token da instância.
   - Atualiza `externalId`, status (`sent|failed|...`) e emite `message:new` no WebSocket.
3. **Mensagens Inbound**
   - Recebidas via webhook Evolution/Meta → `webhooks.service`.
   - Normaliza payload, cria mensagem `INBOUND`, identifica mídia e salva/baixa arquivos.
   - WebSocket notifica clientes (`message:new`).
4. **Mídia**
   - Downloads via `GET /api/messages/:id/media` (stream por Axios com `apikey`).
   - Armazenamento local em `storage/messages/<conversationId>/...` com retenção configurável.

### 4.4 WebSocket (Chat Gateway)
- Room por conversa (`conversation:join/leave`).
- Eventos principais:
  - `message:new` (broadcast após envio/recebimento).
  - `conversation:updated` (atribuição, status).
  - `operator:status` (online/offline).
- Autenticação via token JWT enviado na conexão.

### 4.5 Webhooks Evolution/Meta
- Endpoint principal: `POST /api/webhooks/evolution`.
- Valida assinatura/apikey, roteia eventos:
  - `MESSAGES_UPSERT` → cria mensagens inbound/outbound (confirmações).
  - `MESSAGES_UPDATE` → atualiza status (`delivered`, `read`).
  - `CONNECTION_UPDATE` → atualiza health da instância.
- Reemite updates via WebSocket para sincronizar frontend.

### 4.6 Campanhas
- CSV import (`POST /api/campaigns/upload`) → salva em `storage/campaigns`.
- Configuração: template, instância, delay (`delaySeconds`).
- BullMQ processor (`campaigns.processor.ts`) envia mensagens em lote respeitando throttling.
- Suporta pausa/retomada, estatísticas e registro de falhas.

### 4.7 Relatórios e Tabulações
- `reports` consolida:
  - Conversas finalizadas + filtros (período, operador, instância, tabulação).
  - KPIs: tempo médio resposta operador/cliente, duração, volume.
- Tabulações (`tabulations` módulo) definem motivos obrigatórios ao fechar conversa.

### 4.8 Storage e Retenção
- Serviço `storage` gera paths relativos e remove arquivos expirados (scheduler).
- Config via env `STORAGE_PATH`, `MEDIA_RETENTION_DAYS`.
- Usado por campanhas (CSV), mensagens (mídia) e relatórios exportados.

---

## 5. Fluxos de Deploy e Infra

- **Dev:** `npm run start:dev`, banco/redis via `docker compose up postgres redis`.
- **Prod:** `docker compose -f docker-compose.prod.yml up --build -d`.
- **Migrations:** `npx prisma migrate deploy`; seed inicial `npm run db:seed`.
- **Env críticos:** `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `APP_URL/WEBHOOK_URL`, `STORAGE_PATH`, credenciais Evolution/Meta.

---

## 6. Logs, Monitoramento e Saúde

- Middleware `LoggerMiddleware` registra método, rota, duração, usuário.
- Winston transports (console/file) com correlação contextual.
- Health-check básico via status HTTP (pode ser expandido para `/health`).
- Erros críticos disparados com detalhes (instância, payload, resposta Evolution) para facilitar suporte.

---

## 7. Endpoints de Destaque

- **Auth:** `/api/auth/login`, `/refresh`, `/me`.
- **Usuários:** `/api/users` (CRUD + ativar/desativar).
- **Contatos:** `/api/contacts`, `/import`.
- **Instâncias:** `/api/service-instances`, `/:id/qrcode`.
- **Conversas:** `/api/conversations`, `/:id/assign`, `/:id/close`.
- **Mensagens:** `/api/messages/send`, `/conversation/:id`, `/:id/media`.
- **Campanhas:** `/api/campaigns`, `/upload`, `/pause`, `/resume`.
- **Webhooks:** `/api/webhooks/evolution` e `/api/webhooks/meta`.
- **Relatórios:** `/api/reports/finished-conversations`, `/export`.

---

## 8. Como o Frontend Interage

1. Autentica o usuário e guarda tokens.
2. Lista instâncias e conversas via REST.
3. Usa WebSocket para receber atualizações em tempo real.
4. Envia mensagens via HTTP ou WebSocket (sempre apontando para uma conversa → instância correta).
5. Consome relatórios e exportações via endpoints dedicados.

---

## 9. Próximas Evoluções Planejadas

- Implementar envio completo via Meta Cloud API.
- Suporte ampliado a mídias (vídeo, stickers).
- Métricas/observabilidade (Prometheus + APM).
- Testes automatizados (unitários + e2e).

---

**Resumo:** o backend centraliza toda a lógica de atendimento WhatsApp multi-instância, garantindo segurança (JWT + roles), integração com Evolution API (instâncias, webhooks, mídia), comunicação em tempo real (WebSocket) e operação de alto volume (campanhas BullMQ, Redis). Todos os módulos estão documentados em `docs/` para aprofundamento, mas este arquivo oferece uma visão completa e rápida do funcionamento da API.


