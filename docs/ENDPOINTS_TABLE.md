# Tabela de Endpoints - Referência Rápida

## Legenda de Roles
- 🔴 **ADMIN** - Apenas administradores
- 🟡 **SUPERVISOR** - Supervisores e Admins
- 🟢 **OPERATOR** - Todos os usuários autenticados
- 🔵 **PUBLIC** - Sem autenticação

---

## Health Check

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| GET | `/health` | Verifica status da aplicação | 🔵 PUBLIC |

---

## Autenticação

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/auth/login` | Fazer login e obter tokens | 🔵 PUBLIC |
| POST | `/api/auth/refresh` | Renovar tokens | 🔵 PUBLIC |
| GET | `/api/auth/profile` | Obter perfil do usuário logado | 🟢 OPERATOR |

---

## Usuários

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/users` | Criar novo usuário | 🔴 ADMIN |
| GET | `/api/users` | Listar usuários (paginado) | 🟡 SUPERVISOR |
| GET | `/api/users/me` | Ver próprio perfil | 🟢 OPERATOR |
| GET | `/api/users/online` | Listar operadores online | 🟡 SUPERVISOR |
| PATCH | `/api/users/me/toggle-online` | Alternar status online/offline | 🟢 OPERATOR |
| PATCH | `/api/users/:id` | Atualizar usuário | 🔴 ADMIN |

---

## Contatos

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/contacts` | Criar contato | 🟢 OPERATOR |
| GET | `/api/contacts` | Listar contatos (busca + paginação) | 🟢 OPERATOR |
| GET | `/api/contacts/:id` | Detalhes de um contato | 🟢 OPERATOR |
| PATCH | `/api/contacts/:id` | Atualizar contato | 🟡 SUPERVISOR |
| DELETE | `/api/contacts/:id` | Remover contato | 🟡 SUPERVISOR |
| POST | `/api/contacts/import/csv` | Importar CSV de contatos | 🟢 OPERATOR |

---

## Instâncias de Serviço (WhatsApp)

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/service-instances` | Criar instância WhatsApp | 🔴 ADMIN |
| GET | `/api/service-instances` | Listar instâncias | 🟡 SUPERVISOR |
| GET | `/api/service-instances/:id` | Detalhes de instância | 🟡 SUPERVISOR |
| PATCH | `/api/service-instances/:id` | Atualizar instância | 🔴 ADMIN |
| DELETE | `/api/service-instances/:id` | Remover instância | 🔴 ADMIN |

---

## Templates

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/templates` | Criar template | 🟡 SUPERVISOR |
| GET | `/api/templates` | Listar templates | 🟢 OPERATOR |
| GET | `/api/templates?serviceInstanceId=X` | Filtrar por instância | 🟢 OPERATOR |
| GET | `/api/templates/:id` | Detalhes de template | 🟢 OPERATOR |
| PATCH | `/api/templates/:id` | Atualizar template | 🟡 SUPERVISOR |
| DELETE | `/api/templates/:id` | Remover template | 🟡 SUPERVISOR |

---

## Tabulações

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/tabulations` | Criar tabulação | 🟡 SUPERVISOR |
| GET | `/api/tabulations` | Listar tabulações | 🟢 OPERATOR |
| GET | `/api/tabulations/:id` | Detalhes de tabulação | 🟢 OPERATOR |
| PATCH | `/api/tabulations/:id` | Atualizar tabulação | 🟡 SUPERVISOR |
| DELETE | `/api/tabulations/:id` | Remover tabulação | 🟡 SUPERVISOR |

---

## Conversas

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/conversations` | Abrir nova conversa | 🟢 OPERATOR |
| GET | `/api/conversations` | Listar conversas (filtros) | 🟢 OPERATOR |
| GET | `/api/conversations/queue` | Fila de espera (sem operador) | 🟢 OPERATOR |
| GET | `/api/conversations/:id` | Detalhes de conversa | 🟢 OPERATOR |
| PATCH | `/api/conversations/:id/assign` | Atribuir operador | 🟢 OPERATOR |
| POST | `/api/conversations/:id/close` | Finalizar conversa | 🟢 OPERATOR |

---

## Mensagens

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/messages/send` | Enviar mensagem | 🟢 OPERATOR |
| GET | `/api/messages/conversation/:id` | Histórico de mensagens | 🟢 OPERATOR |
| GET | `/api/messages/:id` | Detalhes de mensagem | 🟢 OPERATOR |

---

## Campanhas

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| POST | `/api/campaigns` | Criar campanha | 🟡 SUPERVISOR |
| POST | `/api/campaigns/:id/upload` | Upload CSV contatos | 🟡 SUPERVISOR |
| POST | `/api/campaigns/:id/start` | Iniciar envios | 🟡 SUPERVISOR |
| PATCH | `/api/campaigns/:id/pause` | Pausar campanha | 🟡 SUPERVISOR |
| PATCH | `/api/campaigns/:id/resume` | Retomar campanha | 🟡 SUPERVISOR |
| GET | `/api/campaigns` | Listar campanhas | 🟡 SUPERVISOR |
| GET | `/api/campaigns/:id` | Detalhes + estatísticas | 🟡 SUPERVISOR |
| DELETE | `/api/campaigns/:id` | Remover campanha | 🟡 SUPERVISOR |

---

## Relatórios

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| GET | `/api/reports/finished-conversations` | Conversas finalizadas | 🟡 SUPERVISOR |
| GET | `/api/reports/finished-conversations/export` | Exportar CSV | 🟡 SUPERVISOR |
| GET | `/api/reports/statistics` | Estatísticas gerais | 🟡 SUPERVISOR |
| GET | `/api/reports/operator-performance` | Performance operadores | 🟡 SUPERVISOR |

---

## Webhooks (Públicos)

| Método | Endpoint | Descrição | Roles |
|--------|----------|-----------|-------|
| GET | `/webhooks/meta` | Verificação webhook Meta | 🔵 PUBLIC |
| POST | `/webhooks/meta` | Receber eventos Meta | 🔵 PUBLIC |
| POST | `/webhooks/evolution` | Receber eventos Evolution | 🔵 PUBLIC |

---

## WebSocket (Namespace: `/chat`)

### Eventos: Cliente → Servidor

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `conversation:join` | Entrar em sala de conversa | `{ conversationId }` |
| `conversation:leave` | Sair de sala | `{ conversationId }` |
| `message:send` | Enviar mensagem | `{ conversationId, content }` |
| `typing:start` | Começar a digitar | `{ conversationId }` |
| `typing:stop` | Parar de digitar | `{ conversationId }` |

### Eventos: Servidor → Cliente

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `user:online` | Usuário conectou | `{ userId, email }` |
| `user:offline` | Usuário desconectou | `{ userId }` |
| `message:new` | Nova mensagem | `MessageResponseDto` |
| `conversation:updated` | Conversa atualizada | `ConversationResponseDto` |
| `conversation:closed` | Conversa fechada | `{ conversationId }` |
| `typing:user` | Usuário digitando | `{ userId, email, isTyping }` |

---

## 📊 Resumo de Permissões

### 🔴 ADMIN (11 endpoints exclusivos)
```
POST   /api/users
PATCH  /api/users/:id
POST   /api/service-instances
PATCH  /api/service-instances/:id
DELETE /api/service-instances/:id
+ todos os endpoints de SUPERVISOR e OPERATOR
```

### 🟡 SUPERVISOR (23 endpoints)
```
GET    /api/users
PATCH  /api/contacts/:id
DELETE /api/contacts/:id
GET    /api/service-instances
GET    /api/service-instances/:id
POST   /api/templates
PATCH  /api/templates/:id
DELETE /api/templates/:id
POST   /api/tabulations
PATCH  /api/tabulations/:id
DELETE /api/tabulations/:id
POST   /api/campaigns (+ 7 endpoints de campanha)
GET    /api/reports/* (4 endpoints de relatório)
+ todos os endpoints de OPERATOR
```

### 🟢 OPERATOR (17 endpoints)
```
GET    /api/auth/profile
GET    /api/users/me
POST   /api/contacts
GET    /api/contacts (+ 2 endpoints read)
POST   /api/contacts/import/csv
GET    /api/templates (+ 1 endpoint read)
GET    /api/tabulations (+ 1 endpoint read)
POST   /api/conversations (+ 5 endpoints de conversa)
POST   /api/messages/send (+ 2 endpoints de mensagem)
WebSocket (todos os eventos)
```

### 🔵 PUBLIC (5 endpoints)
```
GET    /health
POST   /api/auth/login
POST   /api/auth/refresh
GET    /webhooks/meta
POST   /webhooks/meta
POST   /webhooks/evolution
```

---

## 📈 Estatísticas

- **Total de endpoints REST:** 68
- **Endpoints públicos:** 6
- **Endpoints autenticados:** 62
- **Eventos WebSocket (cliente):** 5
- **Eventos WebSocket (servidor):** 6

---

**💡 Dica:** Para detalhes completos de cada endpoint (body, response, exemplos), consulte:
- `ENDPOINTS_REFERENCE.md` - Documentação detalhada
- `API_ENDPOINTS.md` - Documentação técnica completa

