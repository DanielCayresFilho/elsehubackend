# Documentação Completa - Fluxo de Mensagens

## Visão Geral

Este documento explica **como as mensagens funcionam** no sistema Elsehu, incluindo:
- Como mensagens são enviadas (via API REST e WebSocket)
- Como mensagens são recebidas (via Webhooks da Evolution API e Meta)
- Como o WebSocket atualiza o frontend em tempo real
- Como as mensagens são salvas no banco de dados
- Como as conversas são criadas automaticamente

---

## 🔄 Fluxo Completo de Mensagens

### 1. Envio de Mensagens

#### Via API REST (`POST /api/messages/send`)

**Fluxo**:
1. Frontend faz `POST /api/messages/send` com `conversationId` e `content`
2. Backend valida a conversa (deve existir e estar `OPEN`)
3. Backend cria a mensagem no banco com status `pending`
4. Backend envia a mensagem via Evolution API (`POST /message/sendText/{instanceName}`)
5. Backend atualiza a mensagem com `externalId` e status `sent`
6. **Backend emite evento WebSocket `message:new`** para todos os clientes na sala da conversa
7. Frontend recebe a atualização em tempo real

**Código**:
```typescript
// src/messages/messages.service.ts
async send(userId: string, payload: SendMessageDto) {
  // 1. Criar mensagem no banco
  const message = await this.prisma.message.create({...});
  
  // 2. Enviar via Evolution API
  await this.sendViaEvolutionAPI(conversation, message);
  
  // 3. Emitir via WebSocket
  this.chatGateway.emitNewMessage(conversationId, message);
  
  return message;
}
```

#### Via WebSocket (`message:send`)

**Fluxo**:
1. Cliente conecta via WebSocket (`ws://api.elsehub.com/chat`)
2. Cliente entra na sala da conversa (`conversation:join`)
3. Cliente envia evento `message:send` com `conversationId` e `content`
4. Backend processa igual ao REST (cria, envia, atualiza)
5. Backend emite `message:new` para todos na sala
6. Todos os clientes recebem a atualização

**Código**:
```typescript
// src/websockets/chat.gateway.ts
@SubscribeMessage('message:send')
async handleSendMessage(client: Socket, data: { conversationId, content }) {
  const message = await this.messagesService.send(userId, data);
  
  // Emitir para todos na sala
  this.server.to(`conversation:${data.conversationId}`).emit('message:new', message);
  
  return { success: true, message };
}
```

---

### 2. Recebimento de Mensagens

#### Via Webhook da Evolution API

**Fluxo**:
1. Cliente envia mensagem no WhatsApp
2. Evolution API recebe a mensagem
3. Evolution API envia webhook para `POST /api/webhooks/evolution`
4. Backend processa o webhook:
   - Extrai telefone e texto ou metadados de mídia (imagem/áudio/documento)
   - Busca ou cria contato
   - Busca ou cria conversa (com distribuição automática de operador)
   - Cria mensagem no banco com `direction: INBOUND`
   - Emite evento WebSocket `message:new`
5. Frontend recebe a atualização em tempo real

#### Download/Renderização da Mídia

- Toda mídia inbound é baixada e salva em `storage/messages/<conversationId>/...`.
- O arquivo fica exposto publicamente via `/media/messages/<conversationId>/<arquivo>` (campo `mediaPublicUrl`).
- O endpoint `GET /api/messages/:id/media` continua disponível como **fallback autenticado** (usa o token e, se necessário, rebaixa da Evolution).
- Retenção padrão: **3 dias** (configurável via `MEDIA_RETENTION_DAYS`). Depois disso `mediaPublicUrl` fica `null` e o frontend deve exibir “mídia expirada”.

**Eventos da Evolution API**:
- `messages.upsert`: Nova mensagem recebida
- `messages.update`: Atualização de status (sent, delivered, read)

**Código**:
```typescript
// src/webhooks/webhooks.service.ts
async processEvolutionMessage(payload) {
  // Ignorar mensagens enviadas pelo sistema (fromMe: true)
  if (data.key?.fromMe) return;
  
  // Buscar ou criar contato
  let contact = await this.findOrCreateContact(phone);
  
  // Buscar ou criar conversa
  let conversation = await this.findOrCreateConversation(contact, instance);
  
  const storedMedia = media?.url
    ? await this.persistEvolutionMedia(media, serviceInstance, conversation.id)
    : null;

  // Criar mensagem
  const message = await this.messagesService.receiveInbound({
    conversationId: conversation.id,
    content: messageText ?? mediaCaption,
    mediaType: media?.type,
    mediaUrl: media?.url,
    mediaMimeType: media?.mimeType,
    mediaFileName: media?.fileName,
    mediaCaption: media?.caption,
    mediaSize: media?.size,
    mediaStoragePath: storedMedia?.storagePath,
    externalId: data.key.id,
  });
  
  // Emitir via WebSocket
  this.chatGateway.emitNewMessage(conversation.id, message);
}
```

#### Via Webhook da Meta API

**Fluxo**: Similar ao Evolution, mas com formato diferente de payload.

**Código**:
```typescript
// src/webhooks/webhooks.service.ts
async processMetaMessages(value) {
  // Similar ao Evolution, mas com estrutura diferente
  // Busca instância por phoneId ao invés de instanceName
  // Extrai mensagem de value.messages[].text.body
}
```

---

### 3. WebSocket - Atualização em Tempo Real

#### Conexão

**URL**: `ws://api.elsehub.com/chat` ou `wss://api.elsehub.com/chat`

**Autenticação**: Token JWT via:
- Header: `Authorization: Bearer <token>`
- Query: `?token=<token>`

**Eventos do Cliente**:
- `conversation:join` - Entrar na sala de uma conversa
- `conversation:leave` - Sair da sala
- `message:send` - Enviar mensagem
- `typing:start` - Indicar que está digitando
- `typing:stop` - Parar de indicar digitação

**Eventos do Servidor**:
- `message:new` - Nova mensagem (enviada ou recebida)
- `conversation:updated` - Conversa foi atualizada
- `conversation:closed` - Conversa foi fechada
- `user:online` - Usuário conectou
- `user:offline` - Usuário desconectou
- `typing:user` - Usuário está digitando

#### Exemplo de Uso no Frontend

```javascript
// Conectar
const socket = io('wss://api.elsehub.com/chat', {
  auth: { token: 'seu-jwt-token' }
});

// Entrar na sala da conversa
socket.emit('conversation:join', { conversationId: 'uuid' });

// Escutar novas mensagens
socket.on('message:new', (message) => {
  console.log('Nova mensagem:', message);
  // Atualizar UI
});

// Enviar mensagem
socket.emit('message:send', {
  conversationId: 'uuid',
  content: 'Olá!'
});
```

---

## 📊 Persistência no Banco de Dados

### Tabela `messages`

Cada mensagem é salva com:
- `id`: UUID único
- `conversationId`: ID da conversa
- `senderId`: ID do operador (null se for do cliente)
- `content`: Texto da mensagem (ou texto padrão `[Imagem recebida]`, etc.)
- `mediaType`: `IMAGE`, `AUDIO`, `DOCUMENT` (opcional)
- `mediaFileName`, `mediaMimeType`, `mediaSize`, `mediaCaption`, `mediaUrl`: metadados da mídia recebida
- `mediaStoragePath`: caminho relativo dentro de `storage/` (usado para servir `/media/...`)
- `mediaPublicUrl`/`mediaDownloadPath`: URLs prontas para o frontend consumir
- `direction`: `INBOUND` (recebida) ou `OUTBOUND` (enviada)
- `via`: `INBOUND`, `CHAT_MANUAL`, ou `CAMPAIGN`
- `externalId`: ID da mensagem na Evolution/Meta API
- `status`: `pending`, `sent`, `delivered`, `read`, `failed`
- `createdAt`: Data/hora de criação

### Tabela `conversations`

Cada conversa é criada/atualizada com:
- `id`: UUID único
- `contactId`: ID do contato
- `serviceInstanceId`: ID da instância de serviço
- `operatorId`: ID do operador (null se não atribuído)
- `status`: `OPEN` ou `CLOSED`
- `startTime`: Data/hora de início

---

## 🔍 Problemas Comuns e Soluções

### Problema 1: Mensagem Enviada Não Aparece no Frontend

**Causa**: WebSocket não está emitindo o evento após envio.

**Solução**: Verificar se:
1. O `MessagesService.send()` está chamando `chatGateway.emitNewMessage()`
2. O cliente está conectado ao WebSocket
3. O cliente está na sala da conversa (`conversation:join`)

**Código Corrigido**:
```typescript
// src/messages/messages.service.ts
async send(...) {
  // ... criar e enviar mensagem ...
  
  // IMPORTANTE: Emitir via WebSocket
  this.chatGateway.emitNewMessage(conversationId, message);
  
  return message;
}
```

### Problema 2: Mensagem Recebida Não Aparece no Frontend

**Causa**: Webhook não está configurado ou não está processando corretamente.

**Solução**: Verificar se:
1. Webhook da Evolution está configurado: `POST /api/webhooks/evolution`
2. A Evolution API está enviando webhooks para o backend
3. O webhook está processando e emitindo via WebSocket

**Verificação**:
```bash
# Verificar logs do backend
# Deve aparecer: "Webhook Evolution recebido"
# Deve aparecer: "Mensagem Evolution processada: {id}"
```

### Problema 3: Conversa Não é Criada Automaticamente

**Causa**: Webhook não está criando conversa quando recebe mensagem.

**Solução**: Verificar se:
1. O webhook está buscando/criando contato
2. O webhook está buscando/criando conversa
3. A instância de serviço está ativa

**Código**:
```typescript
// src/webhooks/webhooks.service.ts
async processEvolutionMessage(payload) {
  // 1. Buscar ou criar contato
  let contact = await this.findOrCreateContact(phone);
  
  // 2. Buscar ou criar conversa
  let conversation = await this.findOrCreateConversation(contact, instance);
  
  // 3. Criar mensagem
  const message = await this.messagesService.receiveInbound({...});
}
```

### Problema 4: Mensagens Enviadas Aparecem Duplicadas

**Causa**: Webhook da Evolution está recebendo mensagens `fromMe: true` e processando.

**Solução**: O código já ignora mensagens `fromMe: true`:
```typescript
if (data.key?.fromMe) {
  return; // Ignorar mensagens enviadas pelo sistema
}
```

**Verificação**: Se ainda aparecer duplicado, verificar se o webhook está configurado corretamente na Evolution API.

---

## 🔧 Configuração de Webhooks

### Evolution API

**Endpoint**: `POST /api/webhooks/evolution`

**⚠️ IMPORTANTE**: O webhook é configurado **AUTOMATICAMENTE** quando você cria uma instância no sistema!

**Como Funciona**:
1. Quando você cria uma instância Evolution API via `POST /api/service-instances`
2. O backend automaticamente:
   - Cria a instância na Evolution API
   - Configura o webhook para: `{APP_URL}/api/webhooks/evolution`
   - Configura os eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`

**Variável de Ambiente Necessária**:
```bash
# Defina uma dessas variáveis:
APP_URL=https://api.elsehub.com
# OU
WEBHOOK_URL=https://api.elsehub.com/api/webhooks/evolution
```

**Se não configurar a variável de ambiente**:
- O webhook não será configurado automaticamente
- Você precisará configurar manualmente na Evolution API (veja abaixo)

**Configuração Manual (se necessário)**:
1. Acessar o Manager da Evolution API
2. Configurar webhook para: `https://api.elsehub.com/api/webhooks/evolution`
3. Eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`

**Payload Esperado**:
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
      "conversation": "Texto da mensagem"
    },
    "pushName": "Nome do Contato"
  }
}
```

### Meta API

**Endpoint**: `POST /api/webhooks/meta`

**Configuração na Meta**:
1. Acessar Meta for Developers
2. Configurar webhook para: `https://api.elsehub.com/api/webhooks/meta`
3. Eventos: `messages`, `message_status`

**Verificação**: `GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=elsehu_verify_token&hub.challenge=123`

---

## 📝 Checklist de Implementação

### Backend
- [x] Endpoint `POST /api/messages/send` criado
- [x] Integração com Evolution API para envio
- [x] Webhook `POST /api/webhooks/evolution` configurado
- [x] Webhook `POST /api/webhooks/meta` configurado
- [x] WebSocket Gateway implementado
- [x] Emissão de eventos WebSocket após envio
- [x] Emissão de eventos WebSocket após recebimento
- [x] Criação automática de contatos
- [x] Criação automática de conversas
- [x] Distribuição automática de operadores

### Frontend
- [ ] Conectar ao WebSocket na inicialização
- [ ] Entrar na sala da conversa ao abrir chat
- [ ] Escutar evento `message:new` e atualizar UI
- [ ] Enviar mensagem via API REST ou WebSocket
- [ ] Mostrar indicador de digitação (`typing:start/stop`)
- [ ] Tratar desconexão e reconexão do WebSocket

---

## 🎯 Fluxo Completo - Exemplo Prático

### Cenário: Cliente envia mensagem, operador responde

1. **Cliente envia "Olá" no WhatsApp**
   - Evolution API recebe
   - Evolution API envia webhook para backend
   - Backend processa:
     - Cria contato (se não existir)
     - Cria conversa (se não existir)
     - Atribui operador (se disponível)
     - Cria mensagem no banco
     - Emite `message:new` via WebSocket
   - Frontend recebe e atualiza UI

2. **Operador vê a mensagem no frontend**
   - Frontend está conectado ao WebSocket
   - Frontend está na sala da conversa
   - Frontend recebe evento `message:new`
   - Frontend atualiza a lista de mensagens

3. **Operador responde "Olá! Como posso ajudar?"**
   - Frontend envia `POST /api/messages/send`
   - Backend processa:
     - Cria mensagem no banco
     - Envia via Evolution API
     - Atualiza status para `sent`
     - Emite `message:new` via WebSocket
   - Frontend recebe e atualiza UI
   - Cliente recebe no WhatsApp

4. **Status da mensagem é atualizado**
   - Evolution API envia webhook `messages.update`
   - Backend atualiza status (`delivered`, `read`)
   - Backend emite evento (se necessário)

---

## 🔍 Debugging

### Verificar se Mensagens Estão Sendo Salvas

```sql
-- Ver últimas mensagens
SELECT * FROM messages ORDER BY "createdAt" DESC LIMIT 10;

-- Ver mensagens de uma conversa
SELECT * FROM messages WHERE "conversationId" = 'uuid' ORDER BY "createdAt" ASC;
```

### Verificar se WebSocket Está Funcionando

```javascript
// No console do navegador
socket.on('connect', () => console.log('Conectado'));
socket.on('disconnect', () => console.log('Desconectado'));
socket.on('message:new', (msg) => console.log('Nova mensagem:', msg));
```

### Verificar Logs do Backend

```bash
# Procurar por:
# "Mensagem enviada com sucesso"
# "Webhook Evolution recebido"
# "Mensagem Evolution processada"
# "Cliente conectado"
# "message:new emitido"
```

---

## 📚 Referências

- **Evolution API Docs**: https://doc.evolution-api.com/
- **Meta WhatsApp API**: https://developers.facebook.com/docs/whatsapp
- **Socket.IO Docs**: https://socket.io/docs/v4/
- **NestJS WebSockets**: https://docs.nestjs.com/websockets/gateways

---

## ⚠️ Observações Importantes

1. **Mensagens Enviadas**: Quando você envia via API, a mensagem é salva no banco E enviada via Evolution API. O WebSocket é emitido para atualizar o frontend.

2. **Mensagens Recebidas**: Quando o cliente envia no WhatsApp, a Evolution API envia webhook, o backend processa, salva no banco E emite WebSocket.

3. **Duplicação**: O código ignora mensagens `fromMe: true` para evitar duplicação. Se ainda houver duplicação, verificar configuração do webhook.

4. **Conversas**: Conversas são criadas automaticamente quando:
   - Cliente envia primeira mensagem (via webhook)
   - Operador cria manualmente (via API)

5. **WebSocket**: O frontend DEVE estar conectado e na sala da conversa para receber atualizações em tempo real.

6. **Status**: Status das mensagens são atualizados via webhooks (`messages.update`). O frontend pode atualizar a UI quando receber esses eventos.

