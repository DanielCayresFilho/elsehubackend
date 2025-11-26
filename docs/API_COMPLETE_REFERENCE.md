# Documentação Completa da API - Elsehu Backend

Esta documentação descreve todos os endpoints, payloads, autenticação e exemplos de uso da API do backend Elsehu.

**Última atualização**: Janeiro 2025

---

## Índice

1. [Introdução](#1-introdução)
2. [Autenticação e Autorização](#2-autenticação-e-autorização)
3. [Health Check](#3-health-check)
4. [Autenticação](#4-autenticação)
5. [Usuários](#5-usuários)
6. [Contatos](#6-contatos)
7. [Conversas](#7-conversas)
8. [Mensagens](#8-mensagens)
9. [Instâncias de Serviço](#9-instâncias-de-serviço)
10. [Webhooks](#10-webhooks)
11. [Campanhas](#11-campanhas)
12. [Templates](#12-templates)
13. [Tabulações](#13-tabulações)
14. [Relatórios](#14-relatórios)
15. [WebSockets](#15-websockets)
16. [Códigos de Erro](#16-códigos-de-erro)

---

## 1. Introdução

### Base URL

```
https://api.elsehub.covenos.com.br
```

### Prefixo da API

Todos os endpoints (exceto `/health`) são prefixados com `/api`:

```
/api/{resource}
```

### Formato de Dados

- **Content-Type**: `application/json`
- **Respostas**: JSON
- **Encoding**: UTF-8

### Rate Limiting

A API implementa rate limiting global:
- **TTL**: 60 segundos (configurável via `RATE_LIMIT_TTL`)
- **Limite**: 30 requisições por TTL (configurável via `RATE_LIMIT_MAX`)
- **Header de resposta**: `X-RateLimit-*` (quando aplicável)

### Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado com sucesso |
| 204 | No Content - Sucesso sem conteúdo |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido ou ausente |
| 403 | Forbidden - Sem permissão para a ação |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: email duplicado) |
| 422 | Unprocessable Entity - Validação falhou |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Erro interno |

### Estrutura de Erros

Todos os erros seguem este formato:

```json
{
  "statusCode": 400,
  "message": "Mensagem de erro",
  "error": "Bad Request"
}
```

Para erros de validação (422):

```json
{
  "statusCode": 422,
  "message": [
    "email deve ser um email válido",
    "password deve ter pelo menos 8 caracteres"
  ],
  "error": "Unprocessable Entity"
}
```

---

## 2. Autenticação e Autorização

### Autenticação JWT

A API usa JWT (JSON Web Tokens) com dois tipos de tokens:

1. **Access Token**: Expira em 15 minutos (900s)
2. **Refresh Token**: Expira em 7 dias

### Como Autenticar

Envie o access token no header `Authorization`:

```
Authorization: Bearer {accessToken}
```

### Fluxo de Autenticação

1. **Login**: `POST /api/auth/login` → Recebe `accessToken` e `refreshToken`
2. **Usar Access Token**: Incluir no header `Authorization` em todas as requisições
3. **Token Expirado**: Usar `POST /api/auth/refresh` com `refreshToken` para obter novos tokens
4. **Renovar Tokens**: Repetir o processo quando necessário

### Roles (Papéis)

A API possui três níveis de acesso:

- **ADMIN**: Acesso total ao sistema
- **SUPERVISOR**: Pode gerenciar campanhas, templates, tabulações e visualizar relatórios
- **OPERATOR**: Pode gerenciar conversas e mensagens, visualizar contatos

### Endpoints Públicos

Os seguintes endpoints não requerem autenticação (marcados com `@Public()`):

- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/webhooks/meta` (verificação)
- `POST /api/webhooks/meta`
- `POST /api/webhooks/evolution`

### Autorização por Role

Endpoints podem ter restrições de role usando o decorator `@Roles()`. Se não especificado, qualquer usuário autenticado pode acessar.

**Regra especial**: Usuários com role `ADMIN` têm acesso a todos os endpoints, independente das restrições de role.

---

## 3. Health Check

### GET /health

Verifica o status da API.

**Autenticação**: Não requerida (público)

**Resposta 200 OK**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## 4. Autenticação

### POST /api/auth/login

Realiza login e retorna tokens de autenticação.

**Autenticação**: Não requerida (público)

**Request Body**:
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Validações**:
- `email`: Deve ser um email válido
- `password`: Mínimo 6 caracteres

**Resposta 200 OK**:
```json
{
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "usuario@exemplo.com",
    "role": "OPERATOR",
    "isActive": true,
    "isOnline": false,
    "onlineSince": null,
    "lastConversationAssignedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpiresIn": "900s",
    "refreshTokenExpiresIn": "7d"
  }
}
```

**Erros**:
- `401 Unauthorized`: Credenciais inválidas ou usuário inativo

---

### POST /api/auth/refresh

Renova os tokens de autenticação usando um refresh token.

**Autenticação**: Não requerida (público)

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validações**:
- `refreshToken`: String não vazia

**Resposta 200 OK**:
```json
{
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "usuario@exemplo.com",
    "role": "OPERATOR",
    "isActive": true,
    "isOnline": false,
    "onlineSince": null,
    "lastConversationAssignedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpiresIn": "900s",
    "refreshTokenExpiresIn": "7d"
  }
}
```

**Erros**:
- `401 Unauthorized`: Refresh token inválido ou expirado

---

### GET /api/auth/profile

Retorna o perfil do usuário autenticado.

**Autenticação**: Requerida (JWT)

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "usuario@exemplo.com",
  "role": "OPERATOR",
  "isActive": true,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Erros**:
- `401 Unauthorized`: Token inválido ou ausente

---

## 5. Usuários

### POST /api/users

Cria um novo usuário.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Request Body**:
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "password": "senha123456",
  "role": "OPERATOR",
  "isActive": true
}
```

**Validações**:
- `name`: String obrigatória
- `email`: Email válido e único
- `password`: Mínimo 8 caracteres
- `role`: Enum (`ADMIN`, `SUPERVISOR`, `OPERATOR`)
- `isActive`: Boolean (opcional, padrão: `true`)

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "role": "OPERATOR",
  "isActive": true,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `409 Conflict`: Email já existe
- `403 Forbidden`: Sem permissão

---

### GET /api/users

Lista todos os usuários com paginação.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1, mínimo: 1)
- `limit` (opcional): Itens por página (padrão: 25, mínimo: 1, máximo: 100)

**Exemplo**:
```
GET /api/users?page=1&limit=25
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "role": "OPERATOR",
    "isActive": true,
    "isOnline": false,
    "onlineSince": null,
    "lastConversationAssignedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Erros**:
- `403 Forbidden`: Sem permissão

---

### GET /api/users/me

Retorna o usuário atual (autenticado).

**Autenticação**: Requerida (JWT)

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "usuario@exemplo.com",
  "role": "OPERATOR",
  "isActive": true,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

### GET /api/users/online

Lista todos os operadores online.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "role": "OPERATOR",
    "isActive": true,
    "isOnline": true,
    "onlineSince": "2025-01-15T10:00:00.000Z",
    "lastConversationAssignedAt": "2025-01-15T09:30:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
]
```

---

### PATCH /api/users/me/toggle-online

Alterna o status online do usuário atual.

**Autenticação**: Requerida (JWT)

**Request Body**:
```json
{
  "isOnline": true
}
```

**Validações**:
- `isOnline`: Boolean obrigatório

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "usuario@exemplo.com",
  "role": "OPERATOR",
  "isActive": true,
  "isOnline": true,
  "onlineSince": "2025-01-15T10:30:00.000Z",
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

---

### PATCH /api/users/:id

Atualiza um usuário.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Path Parameters**:
- `id`: UUID do usuário

**Request Body** (todos os campos são opcionais):
```json
{
  "name": "João Silva Atualizado",
  "email": "joao.novo@exemplo.com",
  "password": "novasenha123456",
  "role": "SUPERVISOR",
  "isActive": false
}
```

**Validações**:
- `name`: String (opcional)
- `email`: Email válido e único (opcional)
- `password`: Mínimo 8 caracteres (opcional)
- `role`: Enum (`ADMIN`, `SUPERVISOR`, `OPERATOR`) (opcional)
- `isActive`: Boolean (opcional)

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "João Silva Atualizado",
  "email": "joao.novo@exemplo.com",
  "role": "SUPERVISOR",
  "isActive": false,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Usuário não encontrado
- `409 Conflict`: Email já existe (se alterado)
- `403 Forbidden`: Sem permissão

---

### DELETE /api/users/:id

Remove um usuário.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Path Parameters**:
- `id`: UUID do usuário

**Resposta 204 No Content**

**Erros**:
- `404 Not Found`: Usuário não encontrado
- `403 Forbidden`: Sem permissão

---

## 6. Contatos

### POST /api/contacts

Cria um novo contato.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request Body**:
```json
{
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Informação adicional 1",
  "additional2": "Informação adicional 2"
}
```

**Validações**:
- `name`: String obrigatória, máximo 120 caracteres
- `phone`: String obrigatória, formato E.164 (ex: `+5514999999999`), único
- `cpf`: String opcional, máximo 14 caracteres
- `additional1`: String opcional, máximo 255 caracteres
- `additional2`: String opcional, máximo 255 caracteres

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Informação adicional 1",
  "additional2": "Informação adicional 2",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `409 Conflict`: Telefone já existe

---

### GET /api/contacts

Lista contatos com filtros e paginação.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1, mínimo: 1)
- `limit` (opcional): Itens por página (padrão: 25, mínimo: 1, máximo: 100)
- `search` (opcional): Busca por nome ou telefone

**Exemplo**:
```
GET /api/contacts?page=1&limit=25&search=Maria
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "Maria Santos",
    "phone": "+5514999999999",
    "cpf": "12345678901",
    "additional1": "Informação adicional 1",
    "additional2": "Informação adicional 2",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### GET /api/contacts/:id

Retorna um contato por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID do contato

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Informação adicional 1",
  "additional2": "Informação adicional 2",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Contato não encontrado

---

### PATCH /api/contacts/:id

Atualiza um contato.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID do contato

**Request Body** (todos os campos são opcionais):
```json
{
  "name": "Maria Santos Atualizada",
  "phone": "+5514999999998",
  "cpf": "12345678902",
  "additional1": "Nova informação",
  "additional2": null
}
```

**Validações**: Mesmas do POST, mas todos opcionais

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Maria Santos Atualizada",
  "phone": "+5514999999998",
  "cpf": "12345678902",
  "additional1": "Nova informação",
  "additional2": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Contato não encontrado
- `409 Conflict`: Telefone já existe (se alterado)

---

### DELETE /api/contacts/:id

Remove um contato.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID do contato

**Resposta 204 No Content**

**Erros**:
- `404 Not Found`: Contato não encontrado

---

### POST /api/contacts/import/csv

Importa contatos em massa via arquivo CSV.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file`: Arquivo CSV (máximo 5MB)

**Formato do CSV**:
```csv
name,phone,cpf,additional1,additional2
Maria Santos,+5514999999999,12345678901,Info1,Info2
João Silva,+5514999999998,12345678902,Info3,Info4
```

**Validações**:
- Arquivo deve ser CSV (`.csv` ou `text/csv`)
- Tamanho máximo: 5MB
- Colunas obrigatórias: `name`, `phone`
- Colunas opcionais: `cpf`, `additional1`, `additional2`

**Resposta 200 OK**:
```json
{
  "success": true,
  "total": 100,
  "imported": 95,
  "failed": 5,
  "errors": [
    {
      "row": 3,
      "error": "Telefone já existe"
    }
  ]
}
```

**Erros**:
- `400 Bad Request`: Arquivo inválido ou formato incorreto
- `413 Payload Too Large`: Arquivo excede 5MB

---

## 7. Conversas

### POST /api/conversations

Cria uma nova conversa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request Body**:
```json
{
  "contactId": "uuid-do-contato",
  "serviceInstanceId": "uuid-da-instancia"
}
```

**Validações**:
- `contactId`: UUID obrigatório
- `serviceInstanceId`: UUID obrigatório

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "contactId": "uuid-do-contato",
  "contactName": "Maria Santos",
  "contactPhone": "+5514999999999",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "operatorId": "uuid-do-operador",
  "operatorName": "João Silva",
  "status": "OPEN",
  "startTime": "2025-01-15T10:30:00.000Z",
  "messageCount": 0,
  "lastMessageAt": null
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `404 Not Found`: Contato ou instância não encontrados

---

### GET /api/conversations

Lista conversas com filtros e paginação.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)
- `status` (opcional): Filtro por status (`OPEN`, `CLOSED`)
- `operatorId` (opcional): Filtro por operador (UUID)
- `serviceInstanceId` (opcional): Filtro por instância (UUID)
- `search` (opcional): Busca por nome ou telefone do contato

**Exemplo**:
```
GET /api/conversations?status=OPEN&operatorId=uuid&page=1&limit=25
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "contactId": "uuid-do-contato",
    "contactName": "Maria Santos",
    "contactPhone": "+5514999999999",
    "serviceInstanceId": "uuid-da-instancia",
    "serviceInstanceName": "WhatsApp Vendas",
    "operatorId": "uuid-do-operador",
    "operatorName": "João Silva",
    "status": "OPEN",
    "startTime": "2025-01-15T10:30:00.000Z",
    "messageCount": 5,
    "lastMessageAt": "2025-01-15T11:00:00.000Z"
  }
]
```

**Nota**: Operadores veem apenas suas próprias conversas. Supervisores e Admins veem todas.

---

### GET /api/conversations/queue

Retorna a fila de conversas sem operador atribuído.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "contactId": "uuid-do-contato",
    "contactName": "Maria Santos",
    "contactPhone": "+5514999999999",
    "serviceInstanceId": "uuid-da-instancia",
    "serviceInstanceName": "WhatsApp Vendas",
    "operatorId": null,
    "operatorName": null,
    "status": "OPEN",
    "startTime": "2025-01-15T10:30:00.000Z",
    "messageCount": 2,
    "lastMessageAt": "2025-01-15T10:35:00.000Z"
  }
]
```

---

### GET /api/conversations/:id

Retorna uma conversa por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da conversa

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "contactId": "uuid-do-contato",
  "contactName": "Maria Santos",
  "contactPhone": "+5514999999999",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "operatorId": "uuid-do-operador",
  "operatorName": "João Silva",
  "status": "OPEN",
  "startTime": "2025-01-15T10:30:00.000Z",
  "messageCount": 5,
  "lastMessageAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Conversa não encontrada

---

### PATCH /api/conversations/:id/assign

Atribui um operador a uma conversa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da conversa

**Request Body**:
```json
{
  "operatorId": "uuid-do-operador"
}
```

**Validações**:
- `operatorId`: UUID obrigatório

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "contactId": "uuid-do-contato",
  "contactName": "Maria Santos",
  "contactPhone": "+5514999999999",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "operatorId": "uuid-do-operador",
  "operatorName": "João Silva",
  "status": "OPEN",
  "startTime": "2025-01-15T10:30:00.000Z",
  "messageCount": 5,
  "lastMessageAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Conversa ou operador não encontrados
- `400 Bad Request`: Conversa já está atribuída ou fechada

---

### POST /api/conversations/:id/close

Fecha uma conversa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da conversa

**Request Body**:
```json
{
  "tabulationId": "uuid-da-tabulacao"
}
```

**Validações**:
- `tabulationId`: UUID obrigatório (categoria de fechamento)

**Resposta 204 No Content**

**Erros**:
- `404 Not Found`: Conversa ou tabulação não encontradas
- `400 Bad Request`: Conversa já está fechada

---

## 8. Mensagens

### POST /api/messages/send

Envia uma mensagem em uma conversa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request Body**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?",
  "via": "CHAT_MANUAL"
}
```

**Validações**:
- `conversationId`: UUID obrigatório
- `content`: String obrigatória, não vazia
- `via`: Enum opcional (`INBOUND`, `CAMPAIGN`, `CHAT_MANUAL`), padrão: `CHAT_MANUAL`

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-do-operador",
  "senderName": "João Silva",
  "content": "Olá! Como posso ajudar?",
  "hasMedia": false,
  "mediaType": null,
  "mediaFileName": null,
  "mediaMimeType": null,
  "mediaSize": null,
  "mediaCaption": null,
  "mediaStoragePath": null,
  "mediaPublicUrl": null,
  "mediaDownloadPath": null,
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "externalId": "3EB001A01F2AFFDE364543",
  "status": "sent",
  "createdAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `404 Not Found`: Conversa não encontrada ou fechada
- `400 Bad Request`: Instância de serviço inativa

---

### GET /api/messages/conversation/:conversationId

Lista mensagens de uma conversa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `conversationId`: UUID da conversa

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)

**Exemplo**:
```
GET /api/messages/conversation/uuid?page=1&limit=50
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid-da-conversa",
    "senderId": null,
    "senderName": null,
    "content": "Olá, preciso de ajuda",
    "hasMedia": false,
    "mediaType": null,
    "mediaFileName": null,
    "mediaMimeType": null,
    "mediaSize": null,
    "mediaCaption": null,
    "mediaStoragePath": null,
    "mediaPublicUrl": null,
    "mediaDownloadPath": null,
    "direction": "INBOUND",
    "via": "INBOUND",
    "externalId": "3EB001A01F2AFFDE364542",
    "status": "received",
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  {
    "id": "uuid-2",
    "conversationId": "uuid-da-conversa",
    "senderId": "uuid-do-operador",
    "senderName": "João Silva",
    "content": "Olá! Como posso ajudar?",
    "hasMedia": false,
    "direction": "OUTBOUND",
    "via": "CHAT_MANUAL",
    "externalId": "3EB001A01F2AFFDE364543",
    "status": "sent",
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
]
```

**Erros**:
- `404 Not Found`: Conversa não encontrada

---

### GET /api/messages/:id

Retorna uma mensagem por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da mensagem

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-do-operador",
  "senderName": "João Silva",
  "content": "Olá! Como posso ajudar?",
  "hasMedia": false,
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "externalId": "3EB001A01F2AFFDE364543",
  "status": "sent",
  "createdAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Mensagem não encontrada

---

### GET /api/messages/:id/media

Faz download de mídia de uma mensagem.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da mensagem

**Resposta 200 OK**:
- **Content-Type**: Tipo MIME da mídia (ex: `image/jpeg`, `audio/ogg`)
- **Content-Disposition**: `inline; filename="nome-do-arquivo"`
- **Content-Length**: Tamanho em bytes (se disponível)
- **Body**: Stream binário da mídia

**Exemplo de uso**:
```javascript
const response = await fetch('/api/messages/uuid/media', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
```

**Erros**:
- `404 Not Found`: Mensagem não encontrada ou sem mídia
- `404 Not Found`: Mídia não disponível

---

## 9. Instâncias de Serviço

### POST /api/service-instances

Cria uma nova instância de serviço (WhatsApp).

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Request Body**:

**Para Evolution API**:
```json
{
  "name": "WhatsApp Vendas",
  "phone": "5511999999999",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  }
}
```

**Para Meta (WhatsApp Business API)**:
```json
{
  "name": "WhatsApp Oficial",
  "phone": "5511999999999",
  "provider": "OFFICIAL_META",
  "credentials": {
    "wabaId": "123456789",
    "phoneId": "987654321",
    "accessToken": "EAA..."
  }
}
```

**Validações**:
- `name`: String obrigatória
- `phone`: String obrigatória
- `provider`: Enum obrigatório (`OFFICIAL_META`, `EVOLUTION_API`)
- `credentials`: Object obrigatório (estrutura depende do provider)

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "WhatsApp Vendas",
  "phone": "5511999999999",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  },
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Comportamento Especial (Evolution API)**:
- Cria a instância na Evolution API automaticamente
- Configura o webhook automaticamente (se `APP_URL` ou `WEBHOOK_URL` estiver definido)
- Gera QR Code para conexão

**Erros**:
- `400 Bad Request`: Dados inválidos
- `401 Unauthorized`: Token da Evolution/Meta inválido
- `400 Bad Request`: Instância já existe na Evolution

---

### GET /api/service-instances

Lista todas as instâncias de serviço.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `includeInactive` (opcional): Incluir instâncias inativas (`true`/`false`, padrão: `false`)

**Exemplo**:
```
GET /api/service-instances?includeInactive=true
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "WhatsApp Vendas",
    "phone": "5511999999999",
    "provider": "EVOLUTION_API",
    "credentials": {
      "serverUrl": "https://evolution.covenos.com.br",
      "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      "instanceName": "vendas01"
    },
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### GET /api/service-instances/:id

Retorna uma instância por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da instância

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "WhatsApp Vendas",
  "phone": "5511999999999",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  },
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Instância não encontrada

---

### GET /api/service-instances/:id/qrcode

Retorna o QR Code para conexão (apenas Evolution API).

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da instância

**Resposta 200 OK**:
```json
{
  "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "instanceName": "vendas01"
}
```

**Erros**:
- `404 Not Found`: Instância não encontrada
- `400 Bad Request`: Provider não é Evolution API
- `400 Bad Request`: Instância não conectada

---

### PATCH /api/service-instances/:id

Atualiza uma instância de serviço.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Path Parameters**:
- `id`: UUID da instância

**Request Body** (todos os campos são opcionais):
```json
{
  "name": "WhatsApp Vendas Atualizado",
  "phone": "5511999999998",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "novo-token",
    "instanceName": "vendas01"
  },
  "isActive": false
}
```

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "WhatsApp Vendas Atualizado",
  "phone": "5511999999998",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "novo-token",
    "instanceName": "vendas01"
  },
  "isActive": false,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Instância não encontrada

---

### DELETE /api/service-instances/:id

Remove uma instância de serviço.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`

**Path Parameters**:
- `id`: UUID da instância

**Resposta 204 No Content**

**Nota**: Não remove a instância na Evolution API, apenas no sistema.

**Erros**:
- `404 Not Found`: Instância não encontrada

---

## 10. Webhooks

### GET /api/webhooks/meta

Endpoint de verificação do webhook da Meta (WhatsApp Business API).

**Autenticação**: Não requerida (público)

**Query Parameters**:
- `hub.mode`: Deve ser `subscribe`
- `hub.verify_token`: Token de verificação (deve corresponder a `META_VERIFY_TOKEN`)
- `hub.challenge`: String de desafio enviada pela Meta

**Exemplo**:
```
GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=elsehu_verify_token&hub.challenge=123456
```

**Resposta 200 OK**:
```
123456
```

Retorna o `hub.challenge` se o token estiver correto.

**Erros**:
- `403 Forbidden`: Token de verificação inválido

---

### POST /api/webhooks/meta

Recebe webhooks da Meta (WhatsApp Business API).

**Autenticação**: Não requerida (público)

**Request Body**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550555555",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Nome do Contato"
                },
                "wa_id": "5514999999999"
              }
            ],
            "messages": [
              {
                "from": "5514999999999",
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Texto da mensagem"
                }
              }
            ],
            "statuses": [
              {
                "id": "wamid.xxx",
                "status": "sent",
                "timestamp": "1234567890",
                "recipient_id": "5514999999999"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Resposta 200 OK**:
```json
{
  "success": true
}
```

**Nota**: Sempre retorna 200 OK, mesmo em caso de erro, para evitar retry excessivo da Meta.

---

### POST /api/webhooks/evolution

Recebe webhooks da Evolution API.

**Autenticação**: Não requerida (público)

**Request Body**:

**Evento: messages.upsert** (nova mensagem):
```json
{
  "event": "messages.upsert",
  "instance": "vendas01",
  "data": {
    "key": {
      "remoteJid": "5514999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB001A01F2AFFDE364543"
    },
    "message": {
      "conversation": "Texto da mensagem"
    },
    "pushName": "Nome do Contato",
    "messageType": "conversation",
    "messageTimestamp": 1234567890
  }
}
```

**Evento: messages.update** (atualização de status):
```json
{
  "event": "messages.update",
  "instance": "vendas01",
  "data": {
    "key": {
      "id": "3EB001A01F2AFFDE364543"
    },
    "status": "delivered"
  }
}
```

**Resposta 200 OK**:
```json
{
  "success": true
}
```

**Nota**: Sempre retorna 200 OK, mesmo em caso de erro.

---

## 11. Campanhas

### POST /api/campaigns

Cria uma nova campanha de disparo em massa.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request Body**:
```json
{
  "name": "Campanha de Promoção",
  "serviceInstanceId": "uuid-da-instancia",
  "templateId": "uuid-do-template",
  "delaySeconds": 120,
  "scheduledAt": "2025-01-20T10:00:00.000Z"
}
```

**Validações**:
- `name`: String obrigatória
- `serviceInstanceId`: UUID obrigatório
- `templateId`: UUID opcional
- `delaySeconds`: Integer opcional, mínimo 30 (padrão: 120)
- `scheduledAt`: ISO 8601 date string opcional (data/hora agendada)

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "uuid-do-template",
  "templateName": "Template Promoção",
  "supervisorId": "uuid-do-supervisor",
  "supervisorName": "João Silva",
  "csvPath": null,
  "status": "PENDING",
  "scheduledAt": "2025-01-20T10:00:00.000Z",
  "startedAt": null,
  "finishedAt": null,
  "delaySeconds": 120,
  "totalContacts": 0,
  "sentCount": 0,
  "failedCount": 0,
  "pendingCount": 0
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `404 Not Found`: Instância ou template não encontrados

---

### POST /api/campaigns/:id/upload

Faz upload de arquivo CSV com contatos para a campanha.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file`: Arquivo CSV (máximo 10MB)

**Formato do CSV**:
```csv
phone,name
+5514999999999,Maria Santos
+5514999999998,João Silva
```

**Resposta 200 OK**:
```json
{
  "success": true,
  "totalContacts": 100,
  "campaignId": "uuid"
}
```

**Erros**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Arquivo inválido ou formato incorreto
- `413 Payload Too Large`: Arquivo excede 10MB
- `400 Bad Request`: Campanha já iniciada

---

### POST /api/campaigns/:id/start

Inicia uma campanha.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PROCESSING",
  "startedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha sem contatos ou já iniciada

---

### PATCH /api/campaigns/:id/pause

Pausa uma campanha em processamento.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PAUSED"
}
```

**Erros**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha não está em processamento

---

### PATCH /api/campaigns/:id/resume

Retoma uma campanha pausada.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PROCESSING"
}
```

**Erros**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha não está pausada

---

### GET /api/campaigns

Lista todas as campanhas.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "Campanha de Promoção",
    "serviceInstanceId": "uuid-da-instancia",
    "serviceInstanceName": "WhatsApp Vendas",
    "templateId": "uuid-do-template",
    "templateName": "Template Promoção",
    "supervisorId": "uuid-do-supervisor",
    "supervisorName": "João Silva",
    "csvPath": "/storage/campaigns/uuid/contatos.csv",
    "status": "PROCESSING",
    "scheduledAt": null,
    "startedAt": "2025-01-15T11:00:00.000Z",
    "finishedAt": null,
    "delaySeconds": 120,
    "totalContacts": 100,
    "sentCount": 50,
    "failedCount": 2,
    "pendingCount": 48
  }
]
```

---

### GET /api/campaigns/:id

Retorna uma campanha por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "uuid-do-template",
  "templateName": "Template Promoção",
  "supervisorId": "uuid-do-supervisor",
  "supervisorName": "João Silva",
  "csvPath": "/storage/campaigns/uuid/contatos.csv",
  "status": "PROCESSING",
  "scheduledAt": null,
  "startedAt": "2025-01-15T11:00:00.000Z",
  "finishedAt": null,
  "delaySeconds": 120,
  "totalContacts": 100,
  "sentCount": 50,
  "failedCount": 2,
  "pendingCount": 48
}
```

**Erros**:
- `404 Not Found`: Campanha não encontrada

---

### DELETE /api/campaigns/:id

Remove uma campanha.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da campanha

**Resposta 204 No Content**

**Nota**: Não remove campanhas em processamento. Pause ou aguarde conclusão.

**Erros**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha em processamento

---

## 12. Templates

### POST /api/templates

Cria um novo template de mensagem.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request Body**:
```json
{
  "name": "Template de Boas-vindas",
  "body": "Olá {{name}}! Bem-vindo à nossa empresa.",
  "metaTemplateId": "123456",
  "language": "pt_BR",
  "variables": {
    "name": {
      "type": "string",
      "required": true
    }
  },
  "serviceInstanceId": "uuid-da-instancia"
}
```

**Validações**:
- `name`: String obrigatória
- `body`: String obrigatória (texto do template)
- `metaTemplateId`: String opcional (ID do template na Meta)
- `language`: String opcional (ex: `pt_BR`)
- `variables`: Object opcional (estrutura de variáveis)
- `serviceInstanceId`: UUID obrigatório

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "Template de Boas-vindas",
  "body": "Olá {{name}}! Bem-vindo à nossa empresa.",
  "metaTemplateId": "123456",
  "language": "pt_BR",
  "variables": {
    "name": {
      "type": "string",
      "required": true
    }
  },
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas"
}
```

**Erros**:
- `400 Bad Request`: Dados inválidos
- `404 Not Found`: Instância não encontrada

---

### GET /api/templates

Lista templates.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Query Parameters**:
- `serviceInstanceId` (opcional): Filtrar por instância (UUID)

**Exemplo**:
```
GET /api/templates?serviceInstanceId=uuid
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "Template de Boas-vindas",
    "body": "Olá {{name}}! Bem-vindo à nossa empresa.",
    "metaTemplateId": "123456",
    "language": "pt_BR",
    "variables": {
      "name": {
        "type": "string",
        "required": true
      }
    },
    "serviceInstanceId": "uuid-da-instancia",
    "serviceInstanceName": "WhatsApp Vendas"
  }
]
```

---

### GET /api/templates/:id

Retorna um template por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID do template

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Template de Boas-vindas",
  "body": "Olá {{name}}! Bem-vindo à nossa empresa.",
  "metaTemplateId": "123456",
  "language": "pt_BR",
  "variables": {
    "name": {
      "type": "string",
      "required": true
    }
  },
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas"
}
```

**Erros**:
- `404 Not Found`: Template não encontrado

---

### PATCH /api/templates/:id

Atualiza um template.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID do template

**Request Body** (todos os campos são opcionais):
```json
{
  "name": "Template Atualizado",
  "body": "Nova mensagem",
  "metaTemplateId": "789012",
  "language": "pt_BR",
  "variables": {
    "name": {
      "type": "string",
      "required": true
    }
  },
  "serviceInstanceId": "uuid-da-instancia"
}
```

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Template Atualizado",
  "body": "Nova mensagem",
  "metaTemplateId": "789012",
  "language": "pt_BR",
  "variables": {
    "name": {
      "type": "string",
      "required": true
    }
  },
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas"
}
```

**Erros**:
- `404 Not Found`: Template não encontrado

---

### DELETE /api/templates/:id

Remove um template.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID do template

**Resposta 204 No Content**

**Erros**:
- `404 Not Found`: Template não encontrado

---

## 13. Tabulações

### POST /api/tabulations

Cria uma nova tabulação (categoria de fechamento de conversa).

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request Body**:
```json
{
  "name": "Venda Realizada"
}
```

**Validações**:
- `name`: String obrigatória

**Resposta 201 Created**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada"
}
```

---

### GET /api/tabulations

Lista todas as tabulações.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "name": "Venda Realizada"
  },
  {
    "id": "uuid-2",
    "name": "Cliente Desistiu"
  }
]
```

---

### GET /api/tabulations/:id

Retorna uma tabulação por ID.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Path Parameters**:
- `id`: UUID da tabulação

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada"
}
```

**Erros**:
- `404 Not Found`: Tabulação não encontrada

---

### PATCH /api/tabulations/:id

Atualiza uma tabulação.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da tabulação

**Request Body**:
```json
{
  "name": "Venda Realizada - Atualizado"
}
```

**Validações**:
- `name`: String opcional

**Resposta 200 OK**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada - Atualizado"
}
```

**Erros**:
- `404 Not Found`: Tabulação não encontrada

---

### DELETE /api/tabulations/:id

Remove uma tabulação.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Path Parameters**:
- `id`: UUID da tabulação

**Resposta 204 No Content**

**Erros**:
- `404 Not Found`: Tabulação não encontrada

---

## 14. Relatórios

### GET /api/reports/finished-conversations

Lista conversas finalizadas com filtros.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): Filtrar por operador (UUID)
- `tabulationId` (opcional): Filtrar por tabulação (UUID)
- `serviceInstanceId` (opcional): Filtrar por instância (UUID)

**Exemplo**:
```
GET /api/reports/finished-conversations?startDate=2025-01-01&endDate=2025-01-31&operatorId=uuid
```

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid",
    "originalChatId": "uuid-da-conversa",
    "contactName": "Maria Santos",
    "contactPhone": "+5514999999999",
    "operatorName": "João Silva",
    "operatorPhone": null,
    "startTime": "2025-01-15T10:00:00.000Z",
    "endTime": "2025-01-15T11:00:00.000Z",
    "durationSeconds": 3600,
    "avgResponseTimeUser": 120,
    "avgResponseTimeOperator": 60,
    "tabulationName": "Venda Realizada"
  }
]
```

---

### GET /api/reports/finished-conversations/export

Exporta conversas finalizadas como CSV.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**: Mesmos do endpoint anterior

**Resposta 200 OK**:
- **Content-Type**: `text/csv`
- **Content-Disposition**: `attachment; filename="conversas-finalizadas-2025-01-15.csv"`
- **Body**: Arquivo CSV

---

### GET /api/reports/statistics

Retorna estatísticas gerais do sistema.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): Filtrar por operador (UUID)
- `serviceInstanceId` (opcional): Filtrar por instância (UUID)

**Resposta 200 OK**:
```json
{
  "totalConversations": 1000,
  "openConversations": 50,
  "closedConversations": 950,
  "totalMessages": 5000,
  "inboundMessages": 2500,
  "outboundMessages": 2500,
  "avgResponseTime": 120,
  "avgConversationDuration": 1800
}
```

---

### GET /api/reports/operator-performance

Retorna performance de operadores.

**Autenticação**: Requerida (JWT)
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): Filtrar por operador (UUID)

**Resposta 200 OK**:
```json
[
  {
    "operatorId": "uuid",
    "operatorName": "João Silva",
    "totalConversations": 100,
    "closedConversations": 95,
    "avgResponseTime": 60,
    "avgConversationDuration": 1800,
    "totalMessages": 500
  }
]
```

---

## 15. WebSockets

### Conexão

**URL**: `ws://api.elsehub.covenos.com.br/chat` ou `wss://api.elsehub.covenos.com.br/chat`

**Namespace**: `/chat`

**Autenticação**: Token JWT via:
- `auth.token` (preferencial)
- Header `Authorization: Bearer {token}`
- Query parameter `token`

**Exemplo (Socket.IO)**:
```javascript
import { io } from 'socket.io-client';

const socket = io('wss://api.elsehub.covenos.com.br/chat', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});
```

### Eventos do Cliente

#### conversation:join

Entra em uma sala de conversa para receber mensagens em tempo real.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Resposta**:
```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "contactName": "Maria Santos",
    "status": "OPEN"
  }
}
```

---

#### conversation:leave

Sai de uma sala de conversa.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Resposta**:
```json
{
  "success": true
}
```

---

#### message:send

Envia uma mensagem via WebSocket (alternativa ao REST).

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?"
}
```

**Resposta**:
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "content": "Olá! Como posso ajudar?",
    "direction": "OUTBOUND",
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

---

#### typing:start

Indica que o usuário está digitando.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Resposta**:
```json
{
  "success": true
}
```

---

#### typing:stop

Indica que o usuário parou de digitar.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Resposta**:
```json
{
  "success": true
}
```

---

### Eventos do Servidor

#### message:new

Emitido quando uma nova mensagem é criada.

**Payload**:
```json
{
  "id": "uuid",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-do-operador",
  "senderName": "João Silva",
  "content": "Olá! Como posso ajudar?",
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "status": "sent",
  "createdAt": "2025-01-15T11:00:00.000Z"
}
```

---

#### conversation:updated

Emitido quando uma conversa é atualizada (ex: operador atribuído).

**Payload**:
```json
{
  "id": "uuid",
  "operatorId": "uuid-do-operador",
  "operatorName": "João Silva",
  "status": "OPEN"
}
```

---

#### conversation:closed

Emitido quando uma conversa é fechada.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

---

#### typing:user

Emitido quando um usuário está digitando.

**Payload**:
```json
{
  "userId": "uuid",
  "email": "joao@exemplo.com",
  "isTyping": true
}
```

---

#### user:online

Emitido quando um usuário fica online.

**Payload**:
```json
{
  "userId": "uuid",
  "email": "joao@exemplo.com"
}
```

---

#### user:offline

Emitido quando um usuário fica offline.

**Payload**:
```json
{
  "userId": "uuid"
}
```

---

#### error

Emitido em caso de erro.

**Payload**:
```json
{
  "type": "TOKEN_EXPIRED",
  "message": "Token JWT expirado. Renove o token antes de conectar."
}
```

---

## 16. Códigos de Erro

### Erros Comuns

| Código | Mensagem | Descrição |
|--------|----------|-----------|
| 400 | Bad Request | Dados inválidos na requisição |
| 401 | Unauthorized | Token inválido, ausente ou expirado |
| 403 | Forbidden | Usuário não tem permissão para a ação |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: email ou telefone duplicado) |
| 422 | Unprocessable Entity | Erro de validação |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro interno do servidor |

### Mensagens de Validação

Erros de validação (422) retornam um array de mensagens:

```json
{
  "statusCode": 422,
  "message": [
    "email deve ser um email válido",
    "password deve ter pelo menos 8 caracteres",
    "phone deve estar no formato internacional (E.164)"
  ],
  "error": "Unprocessable Entity"
}
```

### Erros de Autenticação

**Token Ausente**:
```json
{
  "statusCode": 401,
  "message": "Token inválido ou ausente",
  "error": "Unauthorized"
}
```

**Token Expirado**:
```json
{
  "statusCode": 401,
  "message": "Token expirado",
  "error": "Unauthorized"
}
```

**Credenciais Inválidas**:
```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "error": "Unauthorized"
}
```

### Erros de Autorização

**Sem Permissão**:
```json
{
  "statusCode": 403,
  "message": "Usuário não autorizado para executar esta ação",
  "error": "Forbidden"
}
```

---

## Anexos

### Enums

#### Role
- `ADMIN`
- `SUPERVISOR`
- `OPERATOR`

#### InstanceProvider
- `OFFICIAL_META`
- `EVOLUTION_API`

#### MessageDirection
- `INBOUND` - Cliente enviou
- `OUTBOUND` - Operador/Sistema enviou

#### MessageVia
- `INBOUND` - Recebida via webhook
- `CAMPAIGN` - Enviada via campanha
- `CHAT_MANUAL` - Enviada manualmente pelo operador

#### ChatStatus
- `OPEN` - Conversa aberta
- `CLOSED` - Conversa fechada

#### CampaignStatus
- `PENDING` - Aguardando início
- `PROCESSING` - Em processamento
- `PAUSED` - Pausada
- `COMPLETED` - Concluída
- `FAILED` - Falhou

### Limites

- **Upload CSV (Contatos)**: 5MB
- **Upload CSV (Campanhas)**: 10MB
- **Rate Limit**: 30 requisições por 60 segundos
- **Paginação**: Máximo 100 itens por página
- **Telefone**: Formato E.164 (ex: `+5514999999999`)

### Formato de Data

Todas as datas são retornadas no formato ISO 8601:
```
2025-01-15T10:30:00.000Z
```

Para query parameters de data, use o mesmo formato:
```
?startDate=2025-01-01T00:00:00.000Z&endDate=2025-01-31T23:59:59.999Z
```

---

**Fim da Documentação**

