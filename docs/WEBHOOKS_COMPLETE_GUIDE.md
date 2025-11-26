# Guia Completo de Webhooks - Meta e Evolution API

Este documento descreve em detalhes como o sistema Elsehu processa webhooks recebidos da Meta (WhatsApp Business API) e da Evolution API, incluindo o fluxo completo de criação de conversas, processamento de mensagens, envio de mensagens e gerenciamento de mídias.

---

## 📋 Índice

1. [Visão Geral](#1-visão-geral)
2. [Configuração de Webhooks](#2-configuração-de-webhooks)
3. [Estrutura dos Webhooks](#3-estrutura-dos-webhooks)
4. [Fluxo de Processamento](#4-fluxo-de-processamento)
5. [Tabelas de Banco de Dados](#5-tabelas-de-banco-de-dados)
6. [Criação de Conversas](#6-criação-de-conversas)
7. [Processamento de Mensagens](#7-processamento-de-mensagens)
8. [Envio de Mensagens](#8-envio-de-mensagens)
9. [Status de Mensagens](#9-status-de-mensagens)
10. [Mídias](#10-mídias)
11. [WebSocket e Notificações em Tempo Real](#11-websocket-e-notificações-em-tempo-real)
12. [Exemplos Práticos](#12-exemplos-práticos)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Visão Geral

O sistema Elsehu recebe webhooks de dois provedores principais:

- **Meta (WhatsApp Business API)**: Webhook oficial da Meta para WhatsApp Business
- **Evolution API**: Webhook da Evolution API (solução alternativa baseada em Baileys)

Ambos os webhooks são processados de forma similar, mas com estruturas de dados diferentes. O sistema:

1. Recebe o webhook no endpoint público
2. Identifica a instância de serviço correspondente
3. Processa a mensagem (cria/atualiza contato, conversa, mensagem)
4. Notifica o frontend via WebSocket
5. Atualiza status quando aplicável

---

## 2. Configuração de Webhooks

### 2.1 Evolution API

**Endpoint do Backend**: `POST /api/webhooks/evolution`

**Configuração Automática**:
Quando você cria uma instância Evolution API via `POST /api/service-instances`, o backend **automaticamente configura o webhook** na Evolution API.

**Variáveis de Ambiente Necessárias**:
```bash
# Defina uma dessas variáveis:
APP_URL=https://api.elsehub.covenos.com.br
# OU
WEBHOOK_URL=https://api.elsehub.covenos.com.br/api/webhooks/evolution
```

**O que é configurado automaticamente**:
- **URL**: `{APP_URL}/api/webhooks/evolution` ou `{WEBHOOK_URL}`
- **Eventos**:
  - `MESSAGES_UPSERT`: Mensagens recebidas/enviadas
  - `MESSAGES_UPDATE`: Atualização de status (sent, delivered, read)
  - `CONNECTION_UPDATE`: Atualização de conexão da instância
- **Configurações**:
  - `webhook_by_events: true`
  - `webhook_base64: true` (para garantir recebimento de mídias)

**Se não configurar a variável**:
- O webhook não será configurado automaticamente
- Você precisará configurar manualmente na Evolution API
- As mensagens recebidas não aparecerão automaticamente no sistema

**Configuração Manual (se necessário)**:
```bash
curl -X POST https://evolution.suaempresa.com/webhook/set/{instanceName} \
  -H "apikey: {apiToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
    "enabled": true,
    "webhook_by_events": true,
    "webhook_base64": true,
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
  }'
```

### 2.2 Meta (WhatsApp Business API)

**Endpoint do Backend**: `POST /api/webhooks/meta`

**Endpoint de Verificação**: `GET /api/webhooks/meta`

**Configuração na Meta**:
1. Acesse o [Meta for Developers](https://developers.facebook.com/)
2. Configure o webhook para: `https://api.elsehub.covenos.com.br/api/webhooks/meta`
3. Selecione os eventos: `messages`, `message_status`
4. Configure o **Verify Token**: deve corresponder à variável `META_VERIFY_TOKEN` (default: `elsehu_verify_token`)

**Variável de Ambiente**:
```bash
META_VERIFY_TOKEN=elsehu_verify_token
```

**Verificação do Webhook**:
A Meta envia uma requisição GET para verificar o webhook:
```
GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=elsehu_verify_token&hub.challenge=123456
```

O backend retorna o `challenge` se o token estiver correto.

---

## 3. Estrutura dos Webhooks

### 3.1 Evolution API

**Endpoint**: `POST /api/webhooks/evolution`

**Estrutura do Payload**:
```json
{
  "event": "messages.upsert",
  "instance": "nome-da-instancia",
  "data": {
    "key": {
      "remoteJid": "55149999255182@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB001A01F2AFFDE364543"
    },
    "message": {
      "conversation": "Texto da mensagem",
      "extendedTextMessage": {
        "text": "Texto longo"
      },
      "imageMessage": {
        "url": "https://evolution.../image.jpg",
        "mimetype": "image/jpeg",
        "caption": "Legenda da imagem",
        "fileLength": 123456,
        "fileName": "imagem.jpg"
      },
      "audioMessage": {
        "url": "https://evolution.../audio.ogg",
        "mimetype": "audio/ogg",
        "fileLength": 456789
      },
      "documentMessage": {
        "url": "https://evolution.../document.pdf",
        "mimetype": "application/pdf",
        "fileName": "documento.pdf",
        "caption": "Descrição"
      },
      "videoMessage": { ... },
      "stickerMessage": { ... }
    },
    "messageType": "conversation",
    "messageTimestamp": 1234567890,
    "pushName": "Nome do Contato",
    "status": "sent"
  },
  "destination": "optional",
  "date_time": "2025-01-01T12:00:00Z",
  "sender": "optional",
  "server_url": "optional",
  "apikey": "optional"
}
```

**Eventos Suportados**:
- `messages.upsert`: Nova mensagem recebida ou enviada
- `messages.update`: Atualização de status de mensagem

**Campos Importantes**:
- `data.key.fromMe`: Se `true`, a mensagem foi enviada pelo sistema (ignorada)
- `data.key.remoteJid`: Telefone do remetente (formato: `55149999255182@s.whatsapp.net`)
- `data.message.conversation`: Texto simples
- `data.message.extendedTextMessage.text`: Texto longo
- `data.message.imageMessage`: Imagem com URL, mimetype, caption, etc.
- `data.message.audioMessage`: Áudio
- `data.message.documentMessage`: Documento
- `data.pushName`: Nome do contato (se disponível)

### 3.2 Meta (WhatsApp Business API)

**Endpoint**: `POST /api/webhooks/meta`

**Estrutura do Payload**:
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
                "wa_id": "55149999255182"
              }
            ],
            "messages": [
              {
                "from": "55149999255182",
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
                "recipient_id": "55149999255182"
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

**Campos Importantes**:
- `entry[].changes[].value.metadata.phone_number_id`: ID do número de telefone (usado para identificar a instância)
- `entry[].changes[].value.messages[]`: Array de mensagens recebidas
- `entry[].changes[].value.statuses[]`: Array de atualizações de status
- `messages[].from`: Telefone do remetente
- `messages[].type`: Tipo da mensagem (`text`, `image`, `audio`, `document`, `video`)
- `messages[].text.body`: Conteúdo da mensagem de texto

---

## 4. Fluxo de Processamento

### 4.1 Fluxo Geral

```
1. Webhook recebido (POST /api/webhooks/{meta|evolution})
   ↓
2. Identificar instância de serviço
   - Meta: Buscar por phone_number_id nas credenciais
   - Evolution: Buscar por instanceName nas credenciais
   ↓
3. Normalizar telefone do contato
   - Remover caracteres especiais
   - Garantir formato E.164 (+55149999255182)
   ↓
4. Buscar ou criar contato
   - Buscar por telefone normalizado
   - Se não existir, criar com nome (se disponível)
   ↓
5. Buscar ou criar conversa
   - Buscar conversa aberta para o contato + instância
   - Se não existir, criar nova conversa
   - Atribuir operador disponível (se houver)
   ↓
6. Processar mensagem
   - Extrair texto ou mídia
   - Baixar mídia (se aplicável)
   - Salvar mídia localmente (se aplicável)
   ↓
7. Criar registro de mensagem
   - Salvar no banco de dados
   - Status inicial: "received" (inbound) ou "pending" (outbound)
   ↓
8. Notificar frontend via WebSocket
   - Emitir evento "new_message" para a conversa
   ↓
9. Retornar 200 OK para o webhook
```

### 4.2 Processamento de Mensagens Inbound (Recebidas)

**Evolution API**:
1. Verificar se `data.key.fromMe === false` (ignorar mensagens enviadas pelo sistema)
2. Verificar se não é mensagem de grupo (`remoteJid.endsWith('@g.us')`)
3. Extrair texto de `data.message.conversation` ou `data.message.extendedTextMessage.text`
4. Extrair mídia de `data.message.imageMessage`, `audioMessage`, `documentMessage`
5. Baixar mídia da URL ou via Base64
6. Salvar mídia localmente (se bem-sucedido)
7. Criar mensagem com `direction: INBOUND`, `via: INBOUND`

**Meta API**:
1. Iterar sobre `entry[].changes[].value.messages[]`
2. Extrair texto de `message.text.body` (se `type === 'text'`)
3. Extrair mídia (se `type === 'image'`, `audio`, `document`, `video`)
4. Criar mensagem com `direction: INBOUND`, `via: INBOUND`

### 4.3 Processamento de Status (Atualizações)

**Evolution API**:
- Evento: `messages.update`
- Campo: `data.status` (sent, delivered, read, failed)
- Buscar mensagem por `externalId` (data.key.id)
- Atualizar status da mensagem

**Meta API**:
- Campo: `entry[].changes[].value.statuses[]`
- Buscar mensagem por `externalId` (status.id)
- Atualizar status da mensagem

---

## 5. Tabelas de Banco de Dados

### 5.1 Estrutura das Tabelas

#### `contacts` (Contatos)
```sql
id          UUID PRIMARY KEY
name        VARCHAR
phone       VARCHAR UNIQUE (formato E.164: +55149999255182)
cpf         VARCHAR (opcional)
additional1 VARCHAR (opcional)
additional2 VARCHAR (opcional)
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
```

**Relacionamentos**:
- `conversations`: Uma conversa pertence a um contato
- `campaign_items`: Um contato pode estar em campanhas
- `finished_conversations`: Histórico de conversas finalizadas

#### `service_instances` (Instâncias de Serviço)
```sql
id          UUID PRIMARY KEY
name        VARCHAR
provider    ENUM ('OFFICIAL_META', 'EVOLUTION_API')
phone       VARCHAR (opcional)
credentials JSON (credenciais específicas do provider)
isActive    BOOLEAN
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
```

**Estrutura de `credentials`**:

**Meta**:
```json
{
  "wabaId": "123456789",
  "phoneId": "987654321",
  "accessToken": "EAA..."
}
```

**Evolution**:
```json
{
  "instanceName": "vendas01",
  "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
  "serverUrl": "https://evolution.covenos.com.br"
}
```

#### `conversations` (Conversas)
```sql
id                UUID PRIMARY KEY
contactId         UUID (FK -> contacts.id)
serviceInstanceId UUID (FK -> service_instances.id)
operatorId        UUID NULLABLE (FK -> users.id)
status            ENUM ('OPEN', 'CLOSED')
startTime         TIMESTAMP
```

**Relacionamentos**:
- `contact`: Contato da conversa
- `serviceInstance`: Instância que recebeu/enviou mensagens
- `operator`: Operador atribuído (pode ser NULL se estiver na fila)
- `messages`: Mensagens da conversa

**Lógica**:
- Uma conversa é criada quando uma mensagem inbound é recebida
- Uma conversa pode estar `OPEN` ou `CLOSED`
- Se não houver operador atribuído, a conversa fica na fila
- O sistema atribui automaticamente um operador disponível (round-robin)

#### `messages` (Mensagens)
```sql
id              UUID PRIMARY KEY
conversationId  UUID (FK -> conversations.id)
senderId        UUID NULLABLE (FK -> users.id)
content         TEXT
mediaType       VARCHAR (opcional: 'IMAGE', 'AUDIO', 'DOCUMENT')
mediaUrl        VARCHAR (opcional)
mediaMimeType   VARCHAR (opcional)
mediaFileName   VARCHAR (opcional)
mediaCaption    VARCHAR (opcional)
mediaSize       INTEGER (opcional)
mediaStoragePath VARCHAR (opcional)
direction       ENUM ('INBOUND', 'OUTBOUND')
via             ENUM ('INBOUND', 'CAMPAIGN', 'CHAT_MANUAL')
externalId      VARCHAR (opcional: ID da mensagem no provider)
status          VARCHAR (opcional: 'pending', 'sent', 'delivered', 'read', 'failed', 'received')
createdAt       TIMESTAMP
```

**Relacionamentos**:
- `conversation`: Conversa à qual a mensagem pertence
- `sender`: Usuário que enviou (NULL para mensagens inbound)

**Campos Importantes**:
- `direction`: `INBOUND` = cliente enviou, `OUTBOUND` = operador/sistema enviou
- `via`: `INBOUND` = recebida via webhook, `CAMPAIGN` = enviada via campanha, `CHAT_MANUAL` = enviada manualmente pelo operador
- `externalId`: ID da mensagem no provider (Meta ou Evolution)
- `status`: Status atual da mensagem
- `mediaStoragePath`: Caminho relativo onde a mídia foi salva localmente

### 5.2 Fluxo de Dados

```
Webhook recebido
  ↓
Identificar instância (service_instances)
  ↓
Normalizar telefone
  ↓
Buscar/Criar contato (contacts)
  ↓
Buscar/Criar conversa (conversations)
  ↓
Criar mensagem (messages)
  ↓
Salvar mídia (se aplicável) → storage/
  ↓
Atualizar mediaStoragePath na mensagem
```

---

## 6. Criação de Conversas

### 6.1 Quando uma Conversa é Criada

Uma conversa é criada automaticamente quando:
1. Uma mensagem **inbound** é recebida via webhook
2. Não existe conversa **aberta** (`status = 'OPEN'`) para o contato + instância

### 6.2 Lógica de Atribuição de Operador

Quando uma nova conversa é criada, o sistema tenta atribuir automaticamente um operador:

```typescript
// Busca operadores online, ordenados por:
// 1. Que nunca receberam conversa (lastConversationAssignedAt = null)
// 2. Que receberam conversa há mais tempo (mais antigo primeiro)
const operators = await prisma.user.findMany({
  where: {
    isOnline: true,
    isActive: true,
    role: { in: ['OPERATOR', 'SUPERVISOR'] },
  },
  orderBy: [
    { lastConversationAssignedAt: 'asc' }, // null vem primeiro
  ],
  take: 1,
});
```

**Se encontrar operador**:
- Atribui `operatorId` na conversa
- Atualiza `lastConversationAssignedAt` do operador
- Log: "Conversa atribuída automaticamente ao operador: {nome}"

**Se não encontrar operador**:
- Conversa fica com `operatorId = null`
- Conversa entra na fila (visível em `GET /api/conversations/queued`)
- Log: "Nenhum operador online disponível. Conversa entrará na fila."

### 6.3 Buscar Conversa Existente

Antes de criar uma nova conversa, o sistema verifica se já existe uma conversa aberta:

```typescript
const conversation = await prisma.conversation.findFirst({
  where: {
    contactId: contact.id,
    serviceInstanceId: serviceInstance.id,
    status: ChatStatus.OPEN,
  },
});
```

**Se encontrar**:
- Reutiliza a conversa existente
- Não cria nova conversa
- Não atribui novo operador

**Se não encontrar**:
- Cria nova conversa
- Tenta atribuir operador

---

## 7. Processamento de Mensagens

### 7.1 Extração de Texto

**Evolution API**:
```typescript
// Texto simples
if (data.message?.conversation) {
  return data.message.conversation;
}

// Texto longo
if (data.message?.extendedTextMessage?.text) {
  return data.message.extendedTextMessage.text;
}
```

**Meta API**:
```typescript
if (message.type === 'text' && message.text?.body) {
  return message.text.body;
}
```

### 7.2 Extração de Mídia

**Evolution API** - Tipos Suportados:
- `IMAGE`: `data.message.imageMessage`
- `AUDIO`: `data.message.audioMessage`
- `DOCUMENT`: `data.message.documentMessage`

**Tipos Não Suportados** (geram aviso):
- `VIDEO`: `data.message.videoMessage`
- `STICKER`: `data.message.stickerMessage`

**Estrutura de Mídia Evolution**:
```typescript
{
  type: 'IMAGE' | 'AUDIO' | 'DOCUMENT',
  url: string | null,           // URL da mídia na Evolution
  mimeType: string | null,       // image/jpeg, audio/ogg, etc.
  fileName: string | null,        // Nome do arquivo
  caption: string | null,         // Legenda (se houver)
  size: number | null             // Tamanho em bytes
}
```

**Meta API**:
- Suporte limitado (apenas texto no momento)
- TODO: Implementar suporte para mídias

### 7.3 Download e Armazenamento de Mídia

**Fluxo de Download (Evolution)**:

1. **Tentar download via URL**:
   ```typescript
   const response = await axios.get(mediaPayload.url, {
     responseType: 'arraybuffer',
     headers: { apikey: credentials.apiToken },
   });
   ```

2. **Se falhar, tentar via Base64**:
   ```typescript
   const endpoint = `${serverUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
   const response = await axios.post(endpoint, {
     message: { key: { id: messageId } },
   }, {
     headers: { apikey: apiToken },
   });
   ```

3. **Validar conteúdo**:
   - Verificar se não é HTML/JSON
   - Verificar assinatura de arquivo (JPEG, PNG, GIF, WebP para imagens)
   - Verificar assinatura de áudio (MP3, OGG, WAV)

4. **Salvar localmente**:
   ```typescript
   const savedFile = await storageService.saveFile({
     buffer,
     originalName: fileName,
     subdirectory: `messages/${conversationId}`,
   });
   ```

5. **Atualizar mensagem**:
   ```typescript
   mediaStoragePath: savedFile.relativeToBasePath,
   mediaSize: savedFile.size,
   ```

**Estrutura de Armazenamento**:
```
storage/
  messages/
    {conversationId}/
      imagem-{messageId}.jpg
      audio-{messageId}.ogg
      documento-{messageId}.pdf
```

### 7.4 Criação do Registro de Mensagem

```typescript
const message = await prisma.message.create({
  data: {
    conversationId: conversation.id,
    senderId: null,                    // NULL para mensagens inbound
    content: messageText ?? '[Mídia]',  // Texto ou placeholder
    mediaType: mediaPayload?.type ?? null,
    mediaUrl: mediaPayload?.url ?? null,
    mediaMimeType: mediaPayload?.mimeType ?? null,
    mediaFileName: mediaPayload?.fileName ?? null,
    mediaCaption: mediaPayload?.caption ?? null,
    mediaSize: storedMediaMetadata?.size ?? null,
    mediaStoragePath: storedMediaMetadata?.storagePath ?? null,
    direction: MessageDirection.INBOUND,
    via: MessageVia.INBOUND,
    externalId: data.key?.id ?? message.id,
    status: 'received',
  },
});
```

---

## 8. Envio de Mensagens

### 8.1 Endpoint de Envio

**POST** `/api/messages`

**Autenticação**: Requer token JWT (usuário autenticado)

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Texto da mensagem",
  "via": "CHAT_MANUAL"  // opcional, default: CHAT_MANUAL
}
```

### 8.2 Fluxo de Envio

```
1. Validar conversa (deve estar OPEN)
   ↓
2. Validar instância (deve estar isActive)
   ↓
3. Criar registro de mensagem (status: 'pending')
   ↓
4. Enviar via provider (Evolution ou Meta)
   ↓
5. Atualizar mensagem (status: 'sent', externalId)
   ↓
6. Notificar frontend via WebSocket
   ↓
7. Retornar mensagem criada
```

### 8.3 Envio via Evolution API

**Endpoint da Evolution**:
```
POST {serverUrl}/message/sendText/{instanceName}
```

**Headers**:
```
apikey: {apiToken}
Content-Type: application/json
```

**Payload**:
```json
{
  "number": "55149999255182",  // Telefone sem + e @s.whatsapp.net
  "text": "Texto da mensagem"
}
```

**Resposta Esperada**:
```json
{
  "key": {
    "id": "3EB001A01F2AFFDE364543"
  },
  "status": "PENDING"  // ou "SENT"
}
```

**Atualização da Mensagem**:
```typescript
await prisma.message.update({
  where: { id: message.id },
  data: {
    status: 'sent',  // ou response.data.status.toLowerCase()
    externalId: response.data?.key?.id,
  },
});
```

### 8.4 Envio via Meta API

**Endpoint da Meta**:
```
POST https://graph.facebook.com/{version}/{phoneId}/messages
```

**Headers**:
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Payload**:
```json
{
  "messaging_product": "whatsapp",
  "to": "55149999255182",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Texto da mensagem"
  }
}
```

**Resposta Esperada**:
```json
{
  "messages": [
    {
      "id": "wamid.xxx"
    }
  ]
}
```

**Atualização da Mensagem**:
```typescript
await prisma.message.update({
  where: { id: message.id },
  data: {
    status: 'sent',
    externalId: response.data?.messages?.[0]?.id,
  },
});
```

### 8.5 Tratamento de Erros

**Se o envio falhar**:
```typescript
await prisma.message.update({
  where: { id: message.id },
  data: {
    status: 'failed',
  },
});
```

**Erros Comuns**:
- `404`: Instância não encontrada (Evolution) ou Phone ID inválido (Meta)
- `401`: Token inválido ou expirado
- `400`: Payload inválido ou telefone inválido
- `500`: Erro interno do provider

---

## 9. Status de Mensagens

### 9.1 Status Possíveis

- `pending`: Mensagem criada, aguardando envio
- `sent`: Mensagem enviada com sucesso
- `delivered`: Mensagem entregue ao destinatário
- `read`: Mensagem lida pelo destinatário
- `failed`: Falha ao enviar mensagem
- `received`: Mensagem recebida (apenas inbound)

### 9.2 Atualização de Status via Webhook

**Evolution API**:
- Evento: `messages.update`
- Campo: `data.status` (sent, delivered, read, failed)

**Meta API**:
- Campo: `entry[].changes[].value.statuses[]`
- Campo: `status.status` (sent, delivered, read, failed)

**Processamento**:
```typescript
const message = await prisma.message.findFirst({
  where: { externalId: status.id },
});

if (message) {
  await messagesService.updateStatus(message.id, status.status);
}
```

### 9.3 Consulta de Status

**GET** `/api/messages/:id`

Retorna a mensagem com o status atual:
```json
{
  "id": "uuid",
  "status": "delivered",
  "externalId": "wamid.xxx",
  ...
}
```

---

## 10. Mídias

### 10.1 Tipos de Mídia Suportados

**Evolution API**:
- ✅ `IMAGE`: JPEG, PNG, GIF, WebP
- ✅ `AUDIO`: MP3, OGG, WAV
- ✅ `DOCUMENT`: PDF, DOC, XLS, etc.
- ❌ `VIDEO`: Não suportado (gera aviso)
- ❌ `STICKER`: Não suportado (gera aviso)

**Meta API**:
- ⚠️ Suporte limitado (apenas texto no momento)
- TODO: Implementar suporte para mídias

### 10.2 Download de Mídia

**GET** `/api/messages/:id/media`

**Fluxo**:
1. Buscar mensagem no banco
2. Se `mediaStoragePath` existir, retornar arquivo local
3. Se não, tentar baixar da URL remota (Evolution)
4. Retornar stream com headers apropriados

**Headers de Resposta**:
```
Content-Type: {mediaMimeType}
Content-Disposition: attachment; filename="{mediaFileName}"
Content-Length: {mediaSize}
```

### 10.3 URL Pública de Mídia

Se a mídia foi salva localmente, uma URL pública é gerada:
```
/media/messages/{conversationId}/imagem-{messageId}.jpg
```

**Campo na Resposta**:
```json
{
  "mediaPublicUrl": "/media/messages/.../imagem.jpg",
  "mediaDownloadPath": "/api/messages/{id}/media"
}
```

### 10.4 Retenção de Mídia

**Variável de Ambiente**:
```bash
MEDIA_RETENTION_DAYS=3
```

Mídias antigas são automaticamente removidas após o período configurado (implementação futura).

---

## 11. WebSocket e Notificações em Tempo Real

### 11.1 Eventos WebSocket

Quando uma mensagem é criada ou atualizada, o sistema emite eventos via WebSocket:

**Evento**: `new_message`
**Payload**:
```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "content": "Texto",
    "direction": "INBOUND",
    "status": "received",
    ...
  }
}
```

### 11.2 Quando os Eventos são Emitidos

1. **Mensagem Recebida (Inbound)**:
   - Após processar webhook
   - Após criar registro no banco
   - Emite `new_message` para a conversa

2. **Mensagem Enviada (Outbound)**:
   - Após enviar via provider
   - Após atualizar status
   - Emite `new_message` para a conversa

3. **Status Atualizado**:
   - Após receber webhook de status
   - Após atualizar no banco
   - Emite `new_message` com status atualizado

### 11.3 Implementação no Frontend

```typescript
// Conectar ao WebSocket
const socket = io('ws://api.elsehub.covenos.com.br', {
  auth: { token: accessToken },
});

// Escutar mensagens de uma conversa
socket.on(`conversation:${conversationId}:new_message`, (message) => {
  // Atualizar UI com nova mensagem
  addMessageToChat(message);
});

// Escutar atualizações de status
socket.on(`conversation:${conversationId}:message_updated`, (message) => {
  // Atualizar status da mensagem na UI
  updateMessageStatus(message.id, message.status);
});
```

---

## 12. Exemplos Práticos

### 12.1 Exemplo: Mensagem de Texto Recebida (Evolution)

**Webhook Recebido**:
```json
{
  "event": "messages.upsert",
  "instance": "vendas01",
  "data": {
    "key": {
      "remoteJid": "55149999255182@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB001A01F2AFFDE364543"
    },
    "message": {
      "conversation": "Olá, preciso de ajuda"
    },
    "pushName": "João Silva"
  }
}
```

**Processamento**:
1. Identifica instância: `vendas01` → `service_instances.id`
2. Normaliza telefone: `+55149999255182`
3. Busca contato: Não encontrado → Cria com nome "João Silva"
4. Busca conversa: Não encontrada → Cria nova conversa
5. Atribui operador: Encontra operador disponível → Atribui
6. Cria mensagem: `direction: INBOUND`, `content: "Olá, preciso de ajuda"`
7. Emite WebSocket: `new_message` para a conversa

**Resultado no Banco**:
```sql
-- contacts
INSERT INTO contacts (id, name, phone) VALUES 
  ('uuid-1', 'João Silva', '+55149999255182');

-- conversations
INSERT INTO conversations (id, contactId, serviceInstanceId, operatorId, status) VALUES 
  ('uuid-2', 'uuid-1', 'uuid-instance', 'uuid-operator', 'OPEN');

-- messages
INSERT INTO messages (id, conversationId, content, direction, via, externalId, status) VALUES 
  ('uuid-3', 'uuid-2', 'Olá, preciso de ajuda', 'INBOUND', 'INBOUND', '3EB001A01F2AFFDE364543', 'received');
```

### 12.2 Exemplo: Mensagem com Imagem Recebida (Evolution)

**Webhook Recebido**:
```json
{
  "event": "messages.upsert",
  "instance": "vendas01",
  "data": {
    "key": {
      "remoteJid": "55149999255182@s.whatsapp.net",
      "fromMe": false,
      "id": "3EB001A01F2AFFDE364544"
    },
    "message": {
      "imageMessage": {
        "url": "https://evolution.../image.jpg",
        "mimetype": "image/jpeg",
        "caption": "Veja esta imagem",
        "fileLength": 123456
      }
    },
    "pushName": "João Silva"
  }
}
```

**Processamento**:
1. Identifica instância e contato (já existe)
2. Busca conversa aberta (já existe)
3. Extrai mídia: `type: IMAGE`, `url: ...`, `caption: "Veja esta imagem"`
4. Baixa imagem: `GET https://evolution.../image.jpg` com `apikey`
5. Valida conteúdo: Verifica assinatura JPEG
6. Salva localmente: `storage/messages/{conversationId}/imagem-{messageId}.jpg`
7. Cria mensagem: `content: "Veja esta imagem"`, `mediaType: IMAGE`, `mediaStoragePath: ...`
8. Emite WebSocket: `new_message` com mídia

**Resultado no Banco**:
```sql
-- messages
INSERT INTO messages (
  id, conversationId, content, 
  mediaType, mediaUrl, mediaMimeType, 
  mediaCaption, mediaSize, mediaStoragePath,
  direction, via, externalId, status
) VALUES (
  'uuid-4', 'uuid-2', 'Veja esta imagem',
  'IMAGE', 'https://evolution.../image.jpg', 'image/jpeg',
  'Veja esta imagem', 123456, 'messages/uuid-2/imagem-uuid-4.jpg',
  'INBOUND', 'INBOUND', '3EB001A01F2AFFDE364544', 'received'
);
```

### 12.3 Exemplo: Envio de Mensagem pelo Operador

**Requisição**:
```http
POST /api/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "uuid-2",
  "content": "Olá! Como posso ajudar?"
}
```

**Processamento**:
1. Valida conversa: Existe e está `OPEN`
2. Valida instância: Está `isActive`
3. Cria mensagem: `direction: OUTBOUND`, `status: pending`
4. Envia via Evolution: `POST {serverUrl}/message/sendText/{instanceName}`
5. Atualiza mensagem: `status: sent`, `externalId: 3EB001A01F2AFFDE364545`
6. Emite WebSocket: `new_message` para a conversa

**Resultado no Banco**:
```sql
-- messages
INSERT INTO messages (
  id, conversationId, senderId, content,
  direction, via, status, externalId
) VALUES (
  'uuid-5', 'uuid-2', 'uuid-operator', 'Olá! Como posso ajudar?',
  'OUTBOUND', 'CHAT_MANUAL', 'sent', '3EB001A01F2AFFDE364545'
);
```

### 12.4 Exemplo: Atualização de Status (Evolution)

**Webhook Recebido**:
```json
{
  "event": "messages.update",
  "instance": "vendas01",
  "data": {
    "key": {
      "id": "3EB001A01F2AFFDE364545"
    },
    "status": "delivered"
  }
}
```

**Processamento**:
1. Busca mensagem: `WHERE externalId = '3EB001A01F2AFFDE364545'`
2. Atualiza status: `status = 'delivered'`
3. Emite WebSocket: `message_updated` (opcional)

**Resultado no Banco**:
```sql
-- messages
UPDATE messages 
SET status = 'delivered' 
WHERE externalId = '3EB001A01F2AFFDE364545';
```

---

## 13. Troubleshooting

### 13.1 Mensagens Não Aparecem no Sistema

**Possíveis Causas**:
1. Webhook não configurado
   - **Solução**: Verificar se `APP_URL` ou `WEBHOOK_URL` está definido
   - **Verificação**: Logs ao criar instância devem mostrar "Webhook configurado com sucesso"

2. Instância não encontrada
   - **Solução**: Verificar se `phone_number_id` (Meta) ou `instanceName` (Evolution) está correto nas credenciais
   - **Verificação**: Logs devem mostrar "Instância não encontrada"

3. Telefone não normalizado corretamente
   - **Solução**: Verificar formato do telefone (deve ser E.164: +55149999255182)
   - **Verificação**: Logs devem mostrar "Telefone normalizado: {telefone}"

4. Erro ao processar webhook
   - **Solução**: Verificar logs do backend para erros específicos
   - **Verificação**: Webhook retorna `200 OK` mesmo com erro (para evitar retry excessivo)

### 13.2 Mídias Não São Baixadas

**Possíveis Causas**:
1. URL da mídia inválida
   - **Solução**: Verificar se `serverUrl` está correto nas credenciais
   - **Verificação**: Logs devem mostrar "Falha ao baixar mídia via URL"

2. Token inválido
   - **Solução**: Verificar se `apiToken` está correto e não expirou
   - **Verificação**: Erro 401 ao tentar baixar

3. Conteúdo inválido
   - **Solução**: Verificar se a mídia não é HTML/JSON (pode ser erro da Evolution)
   - **Verificação**: Logs devem mostrar "Conteúdo inválido ao baixar mídia"

4. Fallback para Base64 falha
   - **Solução**: Verificar se o endpoint `/chat/getBase64FromMediaMessage` está disponível
   - **Verificação**: Logs devem mostrar "Erro ao obter mídia em Base64"

### 13.3 Mensagens Duplicadas

**Possíveis Causas**:
1. Webhook configurado múltiplas vezes
   - **Solução**: Verificar se o webhook não está sendo chamado duas vezes
   - **Verificação**: Logs devem mostrar apenas uma vez "Webhook Evolution recebido"

2. Mensagens `fromMe` não sendo ignoradas
   - **Solução**: Verificar se `data.key.fromMe === false` está sendo checado
   - **Verificação**: Logs devem mostrar "Mensagem ignorada: fromMe = true"

3. Processamento paralelo
   - **Solução**: Implementar idempotência com `externalId`
   - **Verificação**: Verificar se mensagens com mesmo `externalId` não são criadas duas vezes

### 13.4 Status Não Atualiza

**Possíveis Causas**:
1. `externalId` não corresponde
   - **Solução**: Verificar se o `externalId` salvo corresponde ao ID do webhook de status
   - **Verificação**: Logs devem mostrar "Status atualizado: {id} -> {status}"

2. Webhook de status não configurado
   - **Solução**: Verificar se o evento `MESSAGES_UPDATE` está configurado (Evolution)
   - **Verificação**: Logs devem mostrar "Webhook Evolution recebido: messages.update"

3. Mensagem não encontrada
   - **Solução**: Verificar se a mensagem foi criada com `externalId` correto
   - **Verificação**: Logs devem mostrar "Mensagem não encontrada para status"

### 13.5 Operador Não Atribuído

**Possíveis Causas**:
1. Nenhum operador online
   - **Solução**: Verificar se há operadores com `isOnline = true` e `isActive = true`
   - **Verificação**: Logs devem mostrar "Nenhum operador online disponível"

2. Operadores sem papel correto
   - **Solução**: Verificar se operadores têm `role = 'OPERATOR'` ou `'SUPERVISOR'`
   - **Verificação**: Query busca apenas `role IN ('OPERATOR', 'SUPERVISOR')`

### 13.6 Logs Úteis

**Evolution API**:
```
[WebhooksService] Webhook Evolution recebido: messages.upsert
[WebhooksService] Processando mensagem Evolution
[WebhooksService] Telefone normalizado: +55149999255182
[WebhooksService] Conteúdo extraído da mensagem: "Olá, preciso de ajuda"
[WebhooksService] Conversa Evolution atribuída automaticamente ao operador: João
[WebhooksService] Emitindo mensagem via WebSocket
[WebhooksService] Mensagem Evolution processada com sucesso: 3EB001A01F2AFFDE364543
```

**Meta API**:
```
[WebhooksService] Webhook Meta recebido
[WebhooksService] Mensagem Meta processada: wamid.xxx
```

**Erros Comuns**:
```
[WebhooksService] Instância Evolution não encontrada: {instance}
[WebhooksService] Mensagem Evolution sem texto e sem mídia suportada, pulando...
[WebhooksService] Erro ao baixar/salvar mídia localmente
[WebhooksService] Falha ao baixar mídia via URL da Evolution
```

---

## 📝 Checklist de Implementação

### Backend
- [x] Endpoints de webhook configurados (`/api/webhooks/meta`, `/api/webhooks/evolution`)
- [x] Verificação de webhook Meta implementada
- [x] Processamento de mensagens inbound (texto e mídia)
- [x] Processamento de atualizações de status
- [x] Download e armazenamento de mídias (Evolution)
- [x] Criação automática de contatos e conversas
- [x] Atribuição automática de operadores
- [x] Notificações via WebSocket
- [x] Envio de mensagens via Evolution e Meta
- [x] Tratamento de erros e logs

### Frontend
- [ ] Conectar ao WebSocket
- [ ] Escutar eventos `new_message`
- [ ] Atualizar UI quando mensagem recebida
- [ ] Exibir mídias (imagens, áudios, documentos)
- [ ] Mostrar status de mensagens (sent, delivered, read)
- [ ] Implementar envio de mensagens
- [ ] Tratar erros de envio

### Infraestrutura
- [ ] Configurar `APP_URL` ou `WEBHOOK_URL`
- [ ] Configurar `META_VERIFY_TOKEN`
- [ ] Configurar `MEDIA_RETENTION_DAYS`
- [ ] Garantir que webhooks sejam acessíveis publicamente
- [ ] Configurar SSL/TLS para webhooks
- [ ] Monitorar logs de webhooks

---

## 🔗 Referências

- [Documentação da Evolution API](https://doc.evolution-api.com/)
- [Documentação da Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Guia de Instâncias](./FRONTEND_INSTANCE_CREATION_GUIDE.md)
- [Guia de Login](./FRONTEND_LOGIN_GUIDE.md)

---

**Última atualização**: Janeiro 2025

