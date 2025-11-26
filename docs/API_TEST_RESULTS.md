# Documentação de Testes da API - Elsehu Backend

**Base URL**: `https://api.elsehub.covenos.com.br`  
**Data**: Janeiro 2025

Esta documentação contém os resultados dos testes de todos os endpoints da API, incluindo payloads de exemplo e respostas esperadas.

---

## Índice

1. [Endpoints Públicos](#1-endpoints-públicos)
2. [Autenticação](#2-autenticação)
3. [Endpoints Protegidos](#3-endpoints-protegidos)
4. [Como Testar](#4-como-testar)
5. [Resultados Esperados](#5-resultados-esperados)

---

## 1. Endpoints Públicos

### GET /health

**Status**: ✅ Público (não requer autenticação)

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/health
```

**Resposta Esperada (200 OK)**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### POST /api/auth/login

**Status**: ✅ Público (não requer autenticação)

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@exemplo.com",
    "password": "senha123456"
  }'
```

**Payload**:
```json
{
  "email": "admin@exemplo.com",
  "password": "senha123456"
}
```

**Validações**:
- `email`: Deve ser um email válido
- `password`: Mínimo 6 caracteres

**Resposta Esperada (200 OK)**:
```json
{
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@exemplo.com",
    "role": "ADMIN",
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

**Erros Possíveis**:
- `401 Unauthorized`: Credenciais inválidas
- `422 Unprocessable Entity`: Validação falhou

---

### POST /api/auth/refresh

**Status**: ✅ Público (não requer autenticação)

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Payload**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@exemplo.com",
    "role": "ADMIN",
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

**Erros Possíveis**:
- `401 Unauthorized`: Refresh token inválido ou expirado

---

### GET /api/webhooks/meta

**Status**: ✅ Público (verificação de webhook)

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=elsehu_verify_token&hub.challenge=123456"
```

**Query Parameters**:
- `hub.mode`: `subscribe`
- `hub.verify_token`: Token de verificação (deve corresponder a `META_VERIFY_TOKEN`)
- `hub.challenge`: String de desafio

**Resposta Esperada (200 OK)**:
```
123456
```

Retorna o `hub.challenge` se o token estiver correto.

**Erros Possíveis**:
- `403 Forbidden`: Token de verificação inválido

---

### POST /api/webhooks/meta

**Status**: ✅ Público (recebe webhooks da Meta)

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": []
  }'
```

**Payload**:
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
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true
}
```

---

### POST /api/webhooks/evolution

**Status**: ✅ Público (recebe webhooks da Evolution)

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{
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
      }
    }
  }'
```

**Payload**:
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
    "pushName": "Nome do Contato"
  }
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true
}
```

---

## 2. Autenticação

Todos os endpoints abaixo requerem autenticação via JWT token no header:

```
Authorization: Bearer {accessToken}
```

**Como obter o token**:
1. Fazer login em `POST /api/auth/login`
2. Usar o `accessToken` retornado no header `Authorization`

**Exemplo**:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET https://api.elsehub.covenos.com.br/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Endpoints Protegidos

### GET /api/auth/profile

**Autenticação**: ✅ Requerida

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/auth/profile \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Admin",
  "email": "admin@exemplo.com",
  "role": "ADMIN",
  "isActive": true,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Erros Possíveis**:
- `401 Unauthorized`: Token inválido ou ausente

---

### POST /api/users

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/users \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Usuário",
    "email": "novo@exemplo.com",
    "password": "senha123456",
    "role": "OPERATOR",
    "isActive": true
  }'
```

**Payload**:
```json
{
  "name": "Novo Usuário",
  "email": "novo@exemplo.com",
  "password": "senha123456",
  "role": "OPERATOR",
  "isActive": true
}
```

**Resposta Esperada (201 Created)**:
```json
{
  "id": "uuid",
  "name": "Novo Usuário",
  "email": "novo@exemplo.com",
  "role": "OPERATOR",
  "isActive": true,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros Possíveis**:
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Sem permissão (não é ADMIN)
- `409 Conflict`: Email já existe
- `422 Unprocessable Entity`: Validação falhou

---

### GET /api/users

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/users?page=1&limit=25" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)

**Resposta Esperada (200 OK)**:
```json
[
  {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@exemplo.com",
    "role": "ADMIN",
    "isActive": true,
    "isOnline": false,
    "onlineSince": null,
    "lastConversationAssignedAt": null,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**Erros Possíveis**:
- `401 Unauthorized`: Token inválido
- `403 Forbidden`: Sem permissão

---

### GET /api/users/me

**Autenticação**: ✅ Requerida

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/users/me \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Admin",
  "email": "admin@exemplo.com",
  "role": "ADMIN",
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/users/online \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
[
  {
    "id": "uuid",
    "name": "Operador",
    "email": "operador@exemplo.com",
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

**Autenticação**: ✅ Requerida

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/users/me/toggle-online \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "isOnline": true
  }'
```

**Payload**:
```json
{
  "isOnline": true
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Admin",
  "email": "admin@exemplo.com",
  "role": "ADMIN",
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/users/{id} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nome Atualizado",
    "isActive": false
  }'
```

**Payload** (todos opcionais):
```json
{
  "name": "Nome Atualizado",
  "email": "novo@exemplo.com",
  "password": "novasenha123456",
  "role": "SUPERVISOR",
  "isActive": false
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Nome Atualizado",
  "email": "novo@exemplo.com",
  "role": "SUPERVISOR",
  "isActive": false,
  "isOnline": false,
  "onlineSince": null,
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Usuário não encontrado
- `403 Forbidden`: Sem permissão

---

### DELETE /api/users/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/users/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

**Erros Possíveis**:
- `404 Not Found`: Usuário não encontrado
- `403 Forbidden`: Sem permissão

---

### POST /api/contacts

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/contacts \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "phone": "+5514999999999",
    "cpf": "12345678901"
  }'
```

**Payload**:
```json
{
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Info adicional 1",
  "additional2": "Info adicional 2"
}
```

**Resposta Esperada (201 Created)**:
```json
{
  "id": "uuid",
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Info adicional 1",
  "additional2": "Info adicional 2",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros Possíveis**:
- `409 Conflict`: Telefone já existe
- `422 Unprocessable Entity`: Validação falhou

---

### GET /api/contacts

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/contacts?page=1&limit=25&search=Maria" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)
- `search` (opcional): Busca por nome ou telefone

**Resposta Esperada (200 OK)**:
```json
[
  {
    "id": "uuid",
    "name": "Maria Santos",
    "phone": "+5514999999999",
    "cpf": "12345678901",
    "additional1": "Info adicional 1",
    "additional2": "Info adicional 2",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
]
```

---

### GET /api/contacts/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/contacts/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Maria Santos",
  "phone": "+5514999999999",
  "cpf": "12345678901",
  "additional1": "Info adicional 1",
  "additional2": "Info adicional 2",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Contato não encontrado

---

### PATCH /api/contacts/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/contacts/{id} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos Atualizada"
  }'
```

**Payload** (todos opcionais):
```json
{
  "name": "Maria Santos Atualizada",
  "phone": "+5514999999998",
  "cpf": "12345678902",
  "additional1": "Nova info",
  "additional2": null
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Maria Santos Atualizada",
  "phone": "+5514999999998",
  "cpf": "12345678902",
  "additional1": "Nova info",
  "additional2": null,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T11:00:00.000Z"
}
```

---

### DELETE /api/contacts/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/contacts/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

---

### POST /api/contacts/import/csv

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/contacts/import/csv \
  -H "Authorization: Bearer {accessToken}" \
  -F "file=@contatos.csv"
```

**Form Data**:
- `file`: Arquivo CSV (máximo 5MB)

**Formato CSV**:
```csv
name,phone,cpf,additional1,additional2
Maria Santos,+5514999999999,12345678901,Info1,Info2
João Silva,+5514999999998,12345678902,Info3,Info4
```

**Resposta Esperada (200 OK)**:
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

**Erros Possíveis**:
- `400 Bad Request`: Arquivo inválido
- `413 Payload Too Large`: Arquivo excede 5MB

---

### POST /api/conversations

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/conversations \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "uuid-do-contato",
    "serviceInstanceId": "uuid-da-instancia"
  }'
```

**Payload**:
```json
{
  "contactId": "uuid-do-contato",
  "serviceInstanceId": "uuid-da-instancia"
}
```

**Resposta Esperada (201 Created)**:
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

---

### GET /api/conversations

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/conversations?status=OPEN&page=1&limit=25" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)
- `status` (opcional): `OPEN` ou `CLOSED`
- `operatorId` (opcional): UUID do operador
- `serviceInstanceId` (opcional): UUID da instância
- `search` (opcional): Busca por nome ou telefone

**Resposta Esperada (200 OK)**:
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

---

### GET /api/conversations/queue

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/conversations/queue \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/conversations/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

---

### PATCH /api/conversations/:id/assign

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/conversations/{id}/assign \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "uuid-do-operador"
  }'
```

**Payload**:
```json
{
  "operatorId": "uuid-do-operador"
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "operatorId": "uuid-do-operador",
  "operatorName": "João Silva",
  "status": "OPEN"
}
```

---

### POST /api/conversations/:id/close

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/conversations/{id}/close \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "tabulationId": "uuid-da-tabulacao"
  }'
```

**Payload**:
```json
{
  "tabulationId": "uuid-da-tabulacao"
}
```

**Resposta Esperada (204 No Content)**

---

### POST /api/messages/send

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/messages/send \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "uuid-da-conversa",
    "content": "Olá! Como posso ajudar?",
    "via": "CHAT_MANUAL"
  }'
```

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?",
  "via": "CHAT_MANUAL"
}
```

**Resposta Esperada (201 Created)**:
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

---

### GET /api/messages/conversation/:conversationId

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/messages/conversation/{conversationId}?page=1&limit=50" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `page` (opcional): Número da página (padrão: 1)
- `limit` (opcional): Itens por página (padrão: 25, máximo: 100)

**Resposta Esperada (200 OK)**:
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid-da-conversa",
    "senderId": null,
    "senderName": null,
    "content": "Olá, preciso de ajuda",
    "hasMedia": false,
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

---

### GET /api/messages/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/messages/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

---

### GET /api/messages/:id/media

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/messages/{id}/media \
  -H "Authorization: Bearer {accessToken}" \
  -o imagem.jpg
```

**Resposta Esperada (200 OK)**:
- **Content-Type**: Tipo MIME da mídia (ex: `image/jpeg`)
- **Content-Disposition**: `inline; filename="nome-do-arquivo"`
- **Body**: Stream binário da mídia

---

### POST /api/service-instances

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/service-instances \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Vendas",
    "phone": "5511999999999",
    "provider": "EVOLUTION_API",
    "credentials": {
      "serverUrl": "https://evolution.covenos.com.br",
      "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      "instanceName": "vendas01"
    }
  }'
```

**Payload (Evolution API)**:
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

**Payload (Meta)**:
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

**Resposta Esperada (201 Created)**:
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

---

### GET /api/service-instances

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/service-instances?includeInactive=false" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `includeInactive` (opcional): `true` ou `false` (padrão: `false`)

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/service-instances/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

---

### GET /api/service-instances/:id/qrcode

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/service-instances/{id}/qrcode \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "qrcode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "base64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "instanceName": "vendas01"
}
```

---

### PATCH /api/service-instances/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/service-instances/{id} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Vendas Atualizado",
    "isActive": false
  }'
```

**Payload** (todos opcionais):
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

**Resposta Esperada (200 OK)**:
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

---

### DELETE /api/service-instances/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/service-instances/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

---

### POST /api/campaigns

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campanha de Promoção",
    "serviceInstanceId": "uuid-da-instancia",
    "templateId": "uuid-do-template",
    "delaySeconds": 120,
    "scheduledAt": "2025-01-20T10:00:00.000Z"
  }'
```

**Payload**:
```json
{
  "name": "Campanha de Promoção",
  "serviceInstanceId": "uuid-da-instancia",
  "templateId": "uuid-do-template",
  "delaySeconds": 120,
  "scheduledAt": "2025-01-20T10:00:00.000Z"
}
```

**Resposta Esperada (201 Created)**:
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

---

### POST /api/campaigns/:id/upload

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/{id}/upload \
  -H "Authorization: Bearer {accessToken}" \
  -F "file=@contatos.csv"
```

**Form Data**:
- `file`: Arquivo CSV (máximo 10MB)

**Formato CSV**:
```csv
phone,name
+5514999999999,Maria Santos
+5514999999998,João Silva
```

**Resposta Esperada (200 OK)**:
```json
{
  "success": true,
  "totalContacts": 100,
  "campaignId": "uuid"
}
```

---

### POST /api/campaigns/:id/start

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/{id}/start \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PROCESSING",
  "startedAt": "2025-01-15T11:00:00.000Z"
}
```

---

### PATCH /api/campaigns/:id/pause

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/campaigns/{id}/pause \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PAUSED"
}
```

---

### PATCH /api/campaigns/:id/resume

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/campaigns/{id}/resume \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Campanha de Promoção",
  "status": "PROCESSING"
}
```

---

### GET /api/campaigns

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/campaigns/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

---

### DELETE /api/campaigns/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/campaigns/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

---

### POST /api/templates

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/templates \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Template de Boas-vindas",
    "body": "Olá {{name}}! Bem-vindo à nossa empresa.",
    "serviceInstanceId": "uuid-da-instancia"
  }'
```

**Payload**:
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

**Resposta Esperada (201 Created)**:
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

---

### GET /api/templates

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/templates?serviceInstanceId=uuid" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `serviceInstanceId` (opcional): Filtrar por instância (UUID)

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/templates/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

---

### PATCH /api/templates/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/templates/{id} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Template Atualizado",
    "body": "Nova mensagem"
  }'
```

**Payload** (todos opcionais):
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

**Resposta Esperada (200 OK)**:
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

---

### DELETE /api/templates/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/templates/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

---

### POST /api/tabulations

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/tabulations \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Venda Realizada"
  }'
```

**Payload**:
```json
{
  "name": "Venda Realizada"
}
```

**Resposta Esperada (201 Created)**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada"
}
```

---

### GET /api/tabulations

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/tabulations \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Request**:
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/tabulations/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada"
}
```

---

### PATCH /api/tabulations/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/tabulations/{id} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Venda Realizada - Atualizado"
  }'
```

**Payload**:
```json
{
  "name": "Venda Realizada - Atualizado"
}
```

**Resposta Esperada (200 OK)**:
```json
{
  "id": "uuid",
  "name": "Venda Realizada - Atualizado"
}
```

---

### DELETE /api/tabulations/:id

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/tabulations/{id} \
  -H "Authorization: Bearer {accessToken}"
```

**Resposta Esperada (204 No Content)**

---

### GET /api/reports/finished-conversations

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/reports/finished-conversations?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): UUID do operador
- `tabulationId` (opcional): UUID da tabulação
- `serviceInstanceId` (opcional): UUID da instância

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/reports/finished-conversations/export?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer {accessToken}" \
  -o conversas.csv
```

**Query Parameters**: Mesmos do endpoint anterior

**Resposta Esperada (200 OK)**:
- **Content-Type**: `text/csv`
- **Content-Disposition**: `attachment; filename="conversas-finalizadas-2025-01-15.csv"`
- **Body**: Arquivo CSV

---

### GET /api/reports/statistics

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/reports/statistics?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): UUID do operador
- `serviceInstanceId` (opcional): UUID da instância

**Resposta Esperada (200 OK)**:
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

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Request**:
```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/reports/operator-performance?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer {accessToken}"
```

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): UUID do operador

**Resposta Esperada (200 OK)**:
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

## 4. Como Testar

### Pré-requisitos

1. **Credenciais de acesso**: Email e senha de um usuário válido
2. **Ferramenta**: `curl`, Postman, ou qualquer cliente HTTP
3. **Token JWT**: Obter via `POST /api/auth/login`

### Fluxo de Teste

1. **Fazer Login**:
   ```bash
   curl -X POST https://api.elsehub.covenos.com.br/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "seu@email.com", "password": "suasenha"}'
   ```

2. **Salvar o Token**:
   ```bash
   TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

3. **Usar o Token**:
   ```bash
   curl -X GET https://api.elsehub.covenos.com.br/api/users/me \
     -H "Authorization: Bearer $TOKEN"
   ```

### Script de Teste Automatizado

Crie um arquivo `test.sh`:

```bash
#!/bin/bash

BASE_URL="https://api.elsehub.covenos.com.br"
EMAIL="seu@email.com"
PASSWORD="suasenha"

# Login
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $RESPONSE | jq -r '.tokens.accessToken')

echo "Token obtido: $TOKEN"

# Testar endpoint
curl -X GET "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Resultados Esperados

### Códigos de Status

| Código | Significado |
|--------|-------------|
| 200 | OK - Sucesso |
| 201 | Created - Recurso criado |
| 204 | No Content - Sucesso sem conteúdo |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - Token inválido |
| 403 | Forbidden - Sem permissão |
| 404 | Not Found - Recurso não encontrado |
| 409 | Conflict - Conflito (ex: duplicado) |
| 422 | Unprocessable Entity - Validação falhou |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error - Erro interno |

### Estrutura de Erros

**Erro Genérico**:
```json
{
  "statusCode": 400,
  "message": "Mensagem de erro",
  "error": "Bad Request"
}
```

**Erro de Validação (422)**:
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

## Notas Finais

- Todos os endpoints protegidos requerem o header `Authorization: Bearer {token}`
- O token expira em 15 minutos (900 segundos)
- Use `POST /api/auth/refresh` para renovar o token
- Rate limit: 30 requisições por 60 segundos
- UUIDs nos exemplos devem ser substituídos por valores reais
- Datas devem estar no formato ISO 8601

---

**Fim da Documentação de Testes**

