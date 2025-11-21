# Referência Rápida de Endpoints

Documento de referência com todos os endpoints da API, suas funcionalidades e permissões de acesso.

**Base URL:** `https://seu-dominio.com/api` (todos os endpoints exceto `/health` e `/webhooks/*`)

**Autenticação:** Header `Authorization: Bearer {access_token}` (exceto endpoints públicos)

---

## 📋 Índice

- [Health Check](#health-check)
- [Autenticação](#autenticação)
- [Usuários](#usuários)
- [Contatos](#contatos)
- [Instâncias de Serviço](#instâncias-de-serviço)
- [Templates](#templates)
- [Tabulações](#tabulações)
- [Conversas](#conversas)
- [Mensagens](#mensagens)
- [Campanhas](#campanhas)
- [Relatórios](#relatórios)
- [Webhooks](#webhooks)
- [WebSocket](#websocket)

---

## Health Check

### `GET /health`
**O que faz:** Verifica se a aplicação está funcionando  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T10:30:00Z"
}
```

---

## Autenticação

### `POST /api/auth/login`
**O que faz:** Realiza login e retorna tokens de acesso  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Body:**
```json
{
  "email": "admin@elsehu.com",
  "password": "senha123"
}
```
**Response:** Usuário + tokens (accessToken, refreshToken)

### `POST /api/auth/refresh`
**O que faz:** Renova os tokens usando o refreshToken  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```
**Response:** Novos tokens + dados do usuário

### `GET /api/auth/profile`
**O que faz:** Retorna dados do usuário autenticado  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Response:** Dados do usuário logado

---

## Usuários

### `POST /api/users`
**O que faz:** Cria novo usuário (operador, supervisor ou admin)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN  
**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "password": "senha123",
  "role": "OPERATOR"
}
```

### `GET /api/users`
**O que faz:** Lista todos os usuários com paginação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Query params:** `page`, `limit`

### `GET /api/users/me`
**O que faz:** Retorna dados do usuário logado  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `GET /api/users/online`
**O que faz:** Lista operadores que estão online e disponíveis para atendimento  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Response:** Lista ordenada por tempo sem receber conversa (próximo a receber)

### `PATCH /api/users/me/toggle-online`
**O que faz:** Alterna status online/offline do operador logado  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "isOnline": true
}
```
**Funcionalidade:** Quando online, operador recebe conversas automaticamente

### `PATCH /api/users/:id`
**O que faz:** Atualiza dados de um usuário específico  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN  
**Body:** Campos opcionais (name, email, password, role, active)

---

## Contatos

### `POST /api/contacts`
**O que faz:** Cria novo contato manualmente  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "name": "Maria Santos",
  "phone": "+5511999999999",
  "cpf": "12345678900",
  "additional1": "Info adicional",
  "additional2": "Outra info"
}
```

### `GET /api/contacts`
**O que faz:** Lista contatos com busca e paginação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Query params:** `page`, `limit`, `search`

### `GET /api/contacts/:id`
**O que faz:** Retorna detalhes de um contato específico  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `PATCH /api/contacts/:id`
**O que faz:** Atualiza dados de um contato  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:** Campos opcionais (name, phone, cpf, additional1, additional2)

### `DELETE /api/contacts/:id`
**O que faz:** Remove um contato permanentemente  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `POST /api/contacts/import/csv`
**O que faz:** Importa múltiplos contatos via arquivo CSV  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:** Form-data com campo `file` (CSV até 5MB)  
**Colunas CSV aceitas:** name/nome, phone/telefone/celular/whatsapp, cpf, additional1/adicional_1, additional2/adicional_2

---

## Instâncias de Serviço

### `POST /api/service-instances`
**O que faz:** Cria nova instância WhatsApp (Meta ou Evolution)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN  
**Body (Meta):**
```json
{
  "name": "WhatsApp Vendas",
  "provider": "OFFICIAL_META",
  "credentials": {
    "wabaId": "123456789",
    "phoneId": "987654321",
    "accessToken": "token_aqui"
  }
}
```
**Body (Evolution):**
```json
{
  "name": "WhatsApp Suporte",
  "provider": "EVOLUTION_API",
  "credentials": {
    "instanceName": "minhaInstancia",
    "apiToken": "token_aqui",
    "serverUrl": "https://evolution.exemplo.com"
  }
}
```

### `GET /api/service-instances`
**O que faz:** Lista todas as instâncias configuradas  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `GET /api/service-instances/:id`
**O que faz:** Retorna detalhes de uma instância específica  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `PATCH /api/service-instances/:id`
**O que faz:** Atualiza configurações de uma instância  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN  
**Body:** Campos opcionais (name, provider, credentials, isActive)

### `DELETE /api/service-instances/:id`
**O que faz:** Remove uma instância (se não houver conversas/campanhas)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN

---

## Templates

### `POST /api/templates`
**O que faz:** Cria template de mensagem para campanhas  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:**
```json
{
  "name": "Boas-vindas",
  "body": "Olá {{nome}}, bem-vindo!",
  "serviceInstanceId": "uuid-da-instancia",
  "language": "pt_BR",
  "metaTemplateId": "id_template_meta",
  "variables": {
    "nome": "text"
  }
}
```

### `GET /api/templates`
**O que faz:** Lista templates (filtro opcional por instância)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Query params:** `serviceInstanceId` (opcional)

### `GET /api/templates/:id`
**O que faz:** Retorna detalhes de um template específico  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `PATCH /api/templates/:id`
**O que faz:** Atualiza um template  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:** Campos opcionais

### `DELETE /api/templates/:id`
**O que faz:** Remove um template  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

---

## Tabulações

### `POST /api/tabulations`
**O que faz:** Cria nova tabulação (ex: "Acordo Gerado", "Sem Interesse")  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:**
```json
{
  "name": "Acordo Gerado"
}
```

### `GET /api/tabulations`
**O que faz:** Lista todas as tabulações  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `GET /api/tabulations/:id`
**O que faz:** Retorna detalhes de uma tabulação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `PATCH /api/tabulations/:id`
**O que faz:** Atualiza nome de uma tabulação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:**
```json
{
  "name": "Novo nome"
}
```

### `DELETE /api/tabulations/:id`
**O que faz:** Remove tabulação (se não houver conversas associadas)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

---

## Conversas

### `POST /api/conversations`
**O que faz:** Abre nova conversa (ou retorna existente se já aberta)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "contactId": "uuid-do-contato",
  "serviceInstanceId": "uuid-da-instancia"
}
```

### `GET /api/conversations`
**O que faz:** Lista conversas com filtros e paginação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Query params:** `status` (OPEN/CLOSED), `operatorId`, `serviceInstanceId`, `search`, `page`, `limit`

### `GET /api/conversations/queue`
**O que faz:** Lista conversas na fila (sem operador atribuído)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `GET /api/conversations/:id`
**O que faz:** Retorna detalhes de uma conversa específica  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

### `PATCH /api/conversations/:id/assign`
**O que faz:** Atribui um operador à conversa  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "operatorId": "uuid-do-operador"
}
```

### `POST /api/conversations/:id/close`
**O que faz:** Finaliza uma conversa e gera registro para relatórios  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "tabulationId": "uuid-da-tabulacao"
}
```

---

## Mensagens

### `POST /api/messages/send`
**O que faz:** Envia mensagem manual em uma conversa  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Body:**
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?"
}
```

### `GET /api/messages/conversation/:conversationId`
**O que faz:** Lista mensagens de uma conversa com paginação  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR  
**Query params:** `page`, `limit`

### `GET /api/messages/:id`
**O que faz:** Retorna detalhes de uma mensagem específica  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR, OPERATOR

---

## Campanhas

### `POST /api/campaigns`
**O que faz:** Cria nova campanha de disparo em massa  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:**
```json
{
  "name": "Black Friday 2025",
  "serviceInstanceId": "uuid-da-instancia",
  "templateId": "uuid-do-template",
  "delaySeconds": 120,
  "scheduledAt": "2025-11-25T10:00:00Z"
}
```

### `POST /api/campaigns/:id/upload`
**O que faz:** Faz upload do CSV com lista de contatos da campanha  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Body:** Form-data com campo `file` (CSV até 10MB)  
**Colunas CSV:** phone/telefone/celular/whatsapp

### `POST /api/campaigns/:id/start`
**O que faz:** Inicia o envio da campanha (adiciona na fila BullMQ)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `PATCH /api/campaigns/:id/pause`
**O que faz:** Pausa uma campanha em execução  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `PATCH /api/campaigns/:id/resume`
**O que faz:** Retoma uma campanha pausada  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `GET /api/campaigns`
**O que faz:** Lista todas as campanhas  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

### `GET /api/campaigns/:id`
**O que faz:** Retorna detalhes de uma campanha (com estatísticas)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Response inclui:** total de contatos, enviados, falhas, pendentes

### `DELETE /api/campaigns/:id`
**O que faz:** Remove uma campanha (apenas se não estiver rodando)  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR

---

## Relatórios

### `GET /api/reports/finished-conversations`
**O que faz:** Lista conversas finalizadas com filtros  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Query params:** `startDate`, `endDate`, `operatorId`, `tabulationId`, `serviceInstanceId`

### `GET /api/reports/finished-conversations/export`
**O que faz:** Exporta conversas finalizadas para CSV  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Query params:** Mesmos filtros acima  
**Response:** Caminho do arquivo CSV gerado

### `GET /api/reports/statistics`
**O que faz:** Retorna estatísticas gerais de atendimento  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Query params:** `startDate`, `endDate`, `operatorId`, `tabulationId`  
**Response:**
```json
{
  "totalConversations": 150,
  "avgDurationSeconds": 480,
  "avgResponseTimeSeconds": 45,
  "tabulationStats": [
    {
      "tabulationId": "uuid",
      "tabulationName": "Acordo Gerado",
      "count": 75
    }
  ]
}
```

### `GET /api/reports/operator-performance`
**O que faz:** Retorna performance individual de cada operador  
**Autenticação:** Requer  
**Roles permitidos:** ADMIN, SUPERVISOR  
**Query params:** `startDate`, `endDate`  
**Response:**
```json
[
  {
    "operatorId": "uuid",
    "operatorName": "João Silva",
    "totalConversations": 50,
    "avgDuration": 420,
    "avgResponseTime": 38
  }
]
```

---

## Webhooks

### `GET /webhooks/meta`
**O que faz:** Verificação do webhook Meta (configuração inicial)  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Query params:** `hub.mode`, `hub.verify_token`, `hub.challenge`  
**Nota:** Configurar `META_VERIFY_TOKEN` no .env

### `POST /webhooks/meta`
**O que faz:** Recebe eventos de mensagens e status da Meta WhatsApp API  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Body:** Payload da Meta (formato proprietário)  
**Funcionalidades:**
- Cria contatos automaticamente
- Abre conversas automaticamente
- Registra mensagens recebidas
- Atualiza status de mensagens enviadas

### `POST /webhooks/evolution`
**O que faz:** Recebe eventos da Evolution API  
**Autenticação:** Não requer  
**Roles permitidos:** Público  
**Body:** Payload da Evolution API  
**Eventos suportados:**
- `messages.upsert` - Nova mensagem recebida
- `messages.update` - Status de mensagem atualizado

---

## WebSocket

**Namespace:** `/chat`  
**URL de conexão:** `ws://seu-dominio.com/chat`  
**Autenticação:** Token JWT via header `Authorization: Bearer {token}` ou query param `?token={token}`

### Eventos Cliente → Servidor

#### `conversation:join`
**O que faz:** Entra em uma sala de conversa para receber atualizações em tempo real  
**Payload:**
```json
{
  "conversationId": "uuid-da-conversa"
}
```

#### `conversation:leave`
**O que faz:** Sai de uma sala de conversa  
**Payload:**
```json
{
  "conversationId": "uuid-da-conversa"
}
```

#### `message:send`
**O que faz:** Envia mensagem em tempo real via WebSocket  
**Payload:**
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Mensagem aqui"
}
```

#### `typing:start`
**O que faz:** Notifica que o usuário começou a digitar  
**Payload:**
```json
{
  "conversationId": "uuid-da-conversa"
}
```

#### `typing:stop`
**O que faz:** Notifica que o usuário parou de digitar  
**Payload:**
```json
{
  "conversationId": "uuid-da-conversa"
}
```

### Eventos Servidor → Cliente

#### `user:online`
**O que faz:** Notifica quando um usuário conecta  
**Payload:**
```json
{
  "userId": "uuid",
  "email": "usuario@exemplo.com"
}
```

#### `user:offline`
**O que faz:** Notifica quando um usuário desconecta  
**Payload:**
```json
{
  "userId": "uuid"
}
```

#### `message:new`
**O que faz:** Nova mensagem recebida/enviada na conversa  
**Payload:** Objeto `MessageResponseDto` completo

#### `conversation:updated`
**O que faz:** Conversa foi atualizada (operador atribuído, etc)  
**Payload:** Objeto `ConversationResponseDto` completo

#### `conversation:closed`
**O que faz:** Conversa foi finalizada  
**Payload:**
```json
{
  "conversationId": "uuid"
}
```

#### `typing:user`
**O que faz:** Outro usuário está digitando (ou parou)  
**Payload:**
```json
{
  "userId": "uuid",
  "email": "usuario@exemplo.com",
  "isTyping": true
}
```

---

## 📊 Resumo por Role

### ADMIN (Administrador)
**Acesso total** a todos os endpoints, incluindo:
- Gerenciamento de usuários
- Configuração de instâncias
- Todas as funcionalidades de SUPERVISOR e OPERATOR

### SUPERVISOR
**Acesso a:**
- Visualização de usuários (sem criar/editar)
- Criação e edição de contatos
- Gerenciamento de templates
- Gerenciamento de tabulações
- Todas as funcionalidades de conversas e mensagens
- Criação e gerenciamento de campanhas
- Acesso completo a relatórios
- WebSocket

### OPERATOR (Operador)
**Acesso a:**
- Visualização do próprio perfil
- Criação de contatos e importação CSV
- Visualização de templates e tabulações
- Atendimento de conversas (abrir, atribuir, fechar)
- Envio e visualização de mensagens
- WebSocket para chat em tempo real

---

## 🔒 Segurança

### Rate Limiting
- **TTL:** 60 segundos (configurável via `RATE_LIMIT_TTL`)
- **Limite:** 30 requisições (configurável via `RATE_LIMIT_MAX`)
- **Aplicado a:** Todos os endpoints exceto `/health` e `/webhooks/*`

### CORS
- Configurável via `ALLOWED_ORIGINS` no .env
- Suporta múltiplas origens (separadas por vírgula)

### Headers de Segurança
- Helmet.js habilitado
- Proteção contra XSS, clickjacking, etc.

---

**Versão:** 1.0.0  
**Última atualização:** 21/11/2025

