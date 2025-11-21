# API Endpoints

> Todos os endpoints (exceto `/health` e `/webhooks/*`) ficam sob o prefixo global `/api`.
> O acesso é protegido por JWT (header `Authorization: Bearer <token>`), com
> regras de `role` aplicadas pelos guards globais.

- **Roles disponíveis**
  - `ADMIN`
  - `SUPERVISOR`
  - `OPERATOR`

- **Códigos de resposta padrão**
  - `200/201`: sucesso
  - `400`: validação
  - `401`: ausência ou expiração do token
  - `403`: falta de permissão para o recurso
  - `404`: registro não encontrado

---

## Health Check

| Método | Caminho   | Autenticação | Descrição                                               |
| ------ | --------- | ------------ | ------------------------------------------------------- |
| GET    | `/health` | Pública      | Retorna `{ status: 'ok', timestamp }` para checagens.   |

> Único endpoint **sem** o prefixo `/api`.

---

## Autenticação (`/api/auth`)

| Método | Caminho        | Auth | Descrição                                                                            |
| ------ | -------------- | ---- | ------------------------------------------------------------------------------------ |
| POST   | `/login`       | Não  | Recebe `{ email, password }`. Retorna usuário + tokens (access/refresh).            |
| POST   | `/refresh`     | Não  | Recebe `{ refreshToken }`. Retorna novo par de tokens e dados do usuário.           |
| GET    | `/profile`     | Sim  | Retorna o usuário autenticado (mesmo payload de `UserResponseDto`).                 |

---

## Usuários (`/api/users`)

| Método | Caminho     | Roles permitidos          | Descrição                                                                                         |
| ------ | ----------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`         | `ADMIN`                   | Cria operador/supervisor/administrador. Body: `CreateUserDto`.                                     |
| GET    | `/`         | `ADMIN`, `SUPERVISOR`     | Lista usuários com paginação (`page`, `limit`).                                                     |
| GET    | `/me`       | Qualquer autenticado      | Retorna o usuário logado.                                                                           |
| PATCH  | `/:id`      | `ADMIN`                   | Atualiza usuário específico. Body parcial (`UpdateUserDto`).                                        |

---

## Contatos (`/api/contacts`)

| Método | Caminho           | Roles permitidos              | Descrição                                                                                                                         |
| ------ | ----------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/`               | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Cria contato (nome, telefone obrigatório). Body: `CreateContactDto`.                                                              |
| GET    | `/`               | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista contatos com paginação (`page`, `limit`) e busca textual (`search`).                                                        |
| GET    | `/:id`            | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Detalha contato específico.                                                                                                       |
| PATCH  | `/:id`            | `ADMIN`, `SUPERVISOR`             | Atualiza campos do contato. Body parcial: `UpdateContactDto`.                                                                     |
| DELETE | `/:id`            | `ADMIN`, `SUPERVISOR`             | Remove contato definitivamente.                                                                                                   |
| POST   | `/import/csv`     | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Upload de CSV (campo `file`, até 5 MB). Processa e cria contatos em lote. Retorno inclui estatísticas e caminho do arquivo salvo. |

---

## Instâncias de Serviço (`/api/service-instances`)

| Método | Caminho     | Roles permitidos          | Descrição                                                                                         |
| ------ | ----------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`         | `ADMIN`                   | Cria instância WhatsApp (Meta ou Evolution). Body: `CreateServiceInstanceDto`.                     |
| GET    | `/`         | `ADMIN`, `SUPERVISOR`     | Lista todas as instâncias configuradas.                                                             |
| GET    | `/:id`      | `ADMIN`, `SUPERVISOR`     | Detalha instância específica.                                                                       |
| PATCH  | `/:id`      | `ADMIN`                   | Atualiza configurações da instância. Body: `UpdateServiceInstanceDto`.                              |
| DELETE | `/:id`      | `ADMIN`                   | Remove instância (apenas se não houver conversas/campanhas associadas).                             |

### Estrutura de Credenciais

**Meta (OFFICIAL_META):**
```json
{
  "wabaId": "123456789",
  "phoneId": "987654321",
  "accessToken": "token_aqui"
}
```

**Evolution API:**
```json
{
  "instanceName": "minhaInstancia",
  "apiToken": "token_aqui",
  "serverUrl": "https://evolution.example.com"
}
```

---

## Templates (`/api/templates`)

| Método | Caminho     | Roles permitidos              | Descrição                                                                                         |
| ------ | ----------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`         | `ADMIN`, `SUPERVISOR`         | Cria template de mensagem. Body: `CreateTemplateDto`.                                               |
| GET    | `/`         | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista templates (filtro opcional: `?serviceInstanceId=...`).                                         |
| GET    | `/:id`      | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Detalha template específico.                                                                         |
| PATCH  | `/:id`      | `ADMIN`, `SUPERVISOR`         | Atualiza template. Body: `UpdateTemplateDto`.                                                        |
| DELETE | `/:id`      | `ADMIN`, `SUPERVISOR`         | Remove template.                                                                                     |

---

## Tabulações (`/api/tabulations`)

| Método | Caminho     | Roles permitidos              | Descrição                                                                                         |
| ------ | ----------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`         | `ADMIN`, `SUPERVISOR`         | Cria tabulação (ex: "Acordo Gerado"). Body: `CreateTabulationDto`.                                  |
| GET    | `/`         | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista todas as tabulações.                                                                           |
| GET    | `/:id`      | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Detalha tabulação específica.                                                                        |
| PATCH  | `/:id`      | `ADMIN`, `SUPERVISOR`         | Atualiza nome da tabulação.                                                                          |
| DELETE | `/:id`      | `ADMIN`, `SUPERVISOR`         | Remove tabulação (apenas se não houver conversas finalizadas associadas).                            |

---

## Conversas (`/api/conversations`)

| Método | Caminho           | Roles permitidos              | Descrição                                                                                         |
| ------ | ----------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`               | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Cria/abre conversa. Body: `CreateConversationDto` (`contactId`, `serviceInstanceId`).                |
| GET    | `/`               | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista conversas com filtros (`status`, `operatorId`, `serviceInstanceId`, `search`, paginação).      |
| GET    | `/queue`          | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista conversas aguardando atribuição (sem operador).                                                 |
| GET    | `/:id`            | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Detalha conversa específica.                                                                          |
| PATCH  | `/:id/assign`     | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Atribui operador à conversa. Body: `AssignConversationDto` (`operatorId`).                           |
| POST   | `/:id/close`      | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Finaliza conversa. Body: `CloseConversationDto` (`tabulationId`).                                    |

---

## Mensagens (`/api/messages`)

| Método | Caminho                      | Roles permitidos              | Descrição                                                                                         |
| ------ | ---------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/send`                      | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Envia mensagem manual. Body: `SendMessageDto` (`conversationId`, `content`).                         |
| GET    | `/conversation/:conversationId` | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Lista mensagens de uma conversa (com paginação).                                                      |
| GET    | `/:id`                       | `ADMIN`, `SUPERVISOR`, `OPERATOR` | Detalha mensagem específica.                                                                          |

---

## WebSocket (`/chat` namespace)

> Conecte via Socket.IO no namespace `/chat`. Autenticação via token JWT (header `Authorization: Bearer <token>` ou query param `?token=...`).

### Eventos do Cliente → Servidor

| Evento                | Payload                                        | Descrição                                                   |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `conversation:join`   | `{ conversationId: string }`                   | Entrar em sala de conversa para receber atualizações.      |
| `conversation:leave`  | `{ conversationId: string }`                   | Sair da sala de conversa.                                   |
| `message:send`        | `{ conversationId: string, content: string }`  | Enviar mensagem em tempo real.                              |
| `typing:start`        | `{ conversationId: string }`                   | Notificar que está digitando.                               |
| `typing:stop`         | `{ conversationId: string }`                   | Notificar que parou de digitar.                             |

### Eventos do Servidor → Cliente

| Evento                | Payload                                        | Descrição                                                   |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `user:online`         | `{ userId: string, email: string }`            | Usuário conectou.                                           |
| `user:offline`        | `{ userId: string }`                           | Usuário desconectou.                                        |
| `message:new`         | `MessageResponseDto`                           | Nova mensagem recebida/enviada na conversa.                 |
| `conversation:updated`| `ConversationResponseDto`                      | Conversa atualizada (operador atribuído, etc).              |
| `conversation:closed` | `{ conversationId: string }`                   | Conversa finalizada.                                        |
| `typing:user`         | `{ userId: string, email: string, isTyping: boolean }` | Outro usuário está digitando.                      |

---

## Webhooks (`/webhooks/*`)

> Endpoints públicos (sem autenticação JWT) para receber eventos das plataformas.

### Meta WhatsApp (`/webhooks/meta`)

| Método | Caminho   | Descrição                                                                                         |
| ------ | --------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/meta`   | Verificação do webhook (Meta envia `hub.mode`, `hub.verify_token`, `hub.challenge`).              |
| POST   | `/meta`   | Recebe eventos de mensagens e status (webhook configurado no Meta Business Manager).              |

**Configuração necessária:**
- Variável de ambiente: `META_VERIFY_TOKEN`
- Webhook URL: `https://seu-dominio.com/webhooks/meta`

### Evolution API (`/webhooks/evolution`)

| Método | Caminho      | Descrição                                                                                         |
| ------ | ------------ | --------------------------------------------------------------------------------------------------- |
| POST   | `/evolution` | Recebe eventos de mensagens da Evolution API (`messages.upsert`, `messages.update`, etc).         |

**Configuração necessária:**
- Configurar webhook na Evolution API apontando para: `https://seu-dominio.com/webhooks/evolution`

---

## Campanhas (`/api/campaigns`)

| Método | Caminho           | Roles permitidos          | Descrição                                                                                         |
| ------ | ----------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| POST   | `/`               | `ADMIN`, `SUPERVISOR`     | Cria campanha de disparo em massa. Body: `CreateCampaignDto`.                                       |
| POST   | `/:id/upload`     | `ADMIN`, `SUPERVISOR`     | Upload do CSV com contatos (campo `file`, até 10 MB).                                               |
| POST   | `/:id/start`      | `ADMIN`, `SUPERVISOR`     | Inicia envio da campanha (adiciona na fila BullMQ).                                                 |
| PATCH  | `/:id/pause`      | `ADMIN`, `SUPERVISOR`     | Pausa campanha em execução.                                                                          |
| PATCH  | `/:id/resume`     | `ADMIN`, `SUPERVISOR`     | Retoma campanha pausada.                                                                             |
| GET    | `/`               | `ADMIN`, `SUPERVISOR`     | Lista todas as campanhas.                                                                            |
| GET    | `/:id`            | `ADMIN`, `SUPERVISOR`     | Detalha campanha (inclui contadores: total, enviados, falhas, pendentes).                           |
| DELETE | `/:id`            | `ADMIN`, `SUPERVISOR`     | Remove campanha (apenas se não estiver em execução).                                                 |

### Formato do CSV de Campanhas

Colunas aceitas: `phone`, `telefone`, `celular`, `whatsapp`

```csv
phone
5511999999999
5511888888888
```

---

## Relatórios (`/api/reports`)

| Método | Caminho                          | Roles permitidos          | Descrição                                                                                         |
| ------ | -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/finished-conversations`        | `ADMIN`, `SUPERVISOR`     | Lista conversas finalizadas (filtros: `startDate`, `endDate`, `operatorId`, `tabulationId`).       |
| GET    | `/finished-conversations/export` | `ADMIN`, `SUPERVISOR`     | Exporta conversas finalizadas em CSV (mesmos filtros).                                              |
| GET    | `/statistics`                    | `ADMIN`, `SUPERVISOR`     | Estatísticas gerais (total conversas, duração média, TMA, tabulações).                              |
| GET    | `/operator-performance`          | `ADMIN`, `SUPERVISOR`     | Performance por operador (conversas atendidas, duração média, TMA).                                 |

---

## Fluxos Auxiliares

- **Throttling**: todos os endpoints (exceto `/health` e `/webhooks/*`) passam pelo `ThrottlerGuard` (`limit` / `ttl` definidos em env).
- **Segurança**: `helmet`, CORS configurável via `ALLOWED_ORIGINS`, rate limiting e validações com `class-validator`.
- **Storage**: uploads são salvos em `STORAGE_PATH` (padrão `./storage`) dentro de subdiretorios organizados.
- **Logging**: Sistema estruturado com Winston, logs salvos em `logs/` em produção com rotação diária.
- **BullMQ**: Fila Redis para processamento assíncrono de campanhas (respeitando `delaySeconds`).

---

## Variáveis de Ambiente

Principais variáveis (ver `env.example` para lista completa):

```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_ACCESS_SECRET=seu_secret_access
JWT_ACCESS_EXPIRES=900s
JWT_REFRESH_SECRET=seu_secret_refresh
JWT_REFRESH_EXPIRES=7d

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=30

# Storage
STORAGE_PATH=./storage

# CORS
ALLOWED_ORIGINS=https://app.exemplo.com,https://admin.exemplo.com

# Webhooks
META_VERIFY_TOKEN=seu_token_de_verificacao
```

---

## Status da Implementação

✅ **Completamente Implementado:**
- Autenticação (JWT access/refresh)
- Usuários (CRUD + roles)
- Contatos (CRUD + importação CSV)
- Instâncias de Serviço (CRUD)
- Templates (CRUD)
- Tabulações (CRUD)
- Conversas (CRUD + atribuição + fechamento)
- Mensagens (envio + histórico)
- WebSocket (chat em tempo real)
- Webhooks (Meta + Evolution)
- Campanhas (BullMQ + processamento assíncrono)
- Relatórios (listagem + export CSV + estatísticas)
- Logging estruturado (Winston)

📝 **TODO (Melhorias Futuras):**
- Integração real com APIs Meta/Evolution (atualmente simulado)
- Suporte a mensagens de mídia (imagem, áudio, vídeo, documento)
- Sistema de filas avançado (priorização, SLA)
- Testes automatizados (unitários + E2E)
- Métricas Prometheus
- APM (Application Performance Monitoring)

---

**Documentação atualizada em:** `r 21/11/2025`
