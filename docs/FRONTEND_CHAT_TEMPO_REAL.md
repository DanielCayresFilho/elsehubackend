# Chat em Tempo Real - Guia para Frontend

## 🎯 Visão Geral

O sistema de chat funciona assim:
1. **Mensagens enviadas** → API → Evolution API → WhatsApp
2. **Mensagens recebidas** → WhatsApp → Evolution API → Webhook → Backend → WebSocket → Frontend

---

## 📡 WebSocket

### Conexão

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://api.elsehub.covenos.com.br/chat', {
  auth: {
    token: accessToken, // ⚠️ Token JWT válido (não expirado)
  },
  transports: ['websocket'],
});
```

### ⚠️ IMPORTANTE: Token JWT

**O token JWT expira em 15 minutos!**

Antes de conectar, verifique se o token está válido:

```typescript
function isTokenExpired(token: string, marginMinutes = 5): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const margin = marginMinutes * 60 * 1000;
    return Date.now() >= (exp - margin);
  } catch {
    return true;
  }
}

// Antes de conectar
if (isTokenExpired(accessToken)) {
  const newToken = await refreshAccessToken(refreshToken);
  connectWebSocket(newToken);
} else {
  connectWebSocket(accessToken);
}
```

### Eventos do WebSocket

#### 1. Conectar a uma Conversa

```typescript
socket.emit('conversation:join', { conversationId: 'xxx' });
```

#### 2. Receber Nova Mensagem

```typescript
socket.on('message:new', (message) => {
  // message = {
  //   id: string,
  //   content: string,
  //   direction: 'INBOUND' | 'OUTBOUND',
  //   conversationId: string,
  //   createdAt: Date,
  //   ...
  // }
  console.log('Nova mensagem:', message);
  // Atualizar UI com a nova mensagem
});
```

#### 3. Sair de uma Conversa

```typescript
socket.emit('conversation:leave', { conversationId: 'xxx' });
```

#### 4. Enviar Mensagem (via WebSocket - opcional)

```typescript
socket.emit('message:send', {
  conversationId: 'xxx',
  content: 'Olá!',
});
```

**Nota:** Você também pode enviar via API REST (recomendado).

#### 5. Tratar Erros

```typescript
socket.on('error', (error) => {
  if (error.type === 'TOKEN_EXPIRED') {
    // Renovar token e reconectar
    refreshAndReconnect();
  }
});
```

---

## 🔌 API REST

### Enviar Mensagem

```typescript
POST /api/messages
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "conversationId": "xxx",
  "content": "Olá, como posso ajudar?"
}
```

**Resposta:**
```json
{
  "id": "msg-123",
  "content": "Olá, como posso ajudar?",
  "direction": "OUTBOUND",
  "conversationId": "xxx",
  "createdAt": "2025-11-23T21:00:00Z"
}
```

### Listar Mensagens de uma Conversa

```typescript
GET /api/messages/conversation/:conversationId
Authorization: Bearer {accessToken}
```

**Resposta:**
```json
[
  {
    "id": "msg-1",
    "content": "Olá",
    "direction": "INBOUND",
    "createdAt": "2025-11-23T20:00:00Z"
  },
  {
    "id": "msg-2",
    "content": "Oi, tudo bem?",
    "direction": "OUTBOUND",
    "createdAt": "2025-11-23T20:01:00Z"
  }
]
```

---

## 🔄 Fluxo Completo

### 1. Usuário Envia Mensagem

```typescript
// Opção 1: Via API (recomendado)
const response = await fetch('/api/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    conversationId: conversationId,
    content: messageText,
  }),
});

const message = await response.json();
// Atualizar UI imediatamente (otimista)
addMessageToUI(message);
```

**O que acontece:**
- Backend salva no banco
- Backend envia para Evolution API
- Backend emite via WebSocket `message:new`
- Frontend recebe e atualiza UI (se já estava conectado)

### 2. Cliente Envia Mensagem (Recebida)

**O que acontece:**
- Cliente envia mensagem no WhatsApp
- Evolution API recebe
- Evolution API chama webhook do backend
- Backend processa e salva no banco
- Backend emite via WebSocket `message:new`
- Frontend recebe e atualiza UI

**Você não precisa fazer nada!** Apenas escutar o evento `message:new`.

---

## 📋 Checklist de Implementação

### WebSocket
- [ ] Verificar token JWT antes de conectar
- [ ] Renovar token se expirado
- [ ] Conectar ao WebSocket com token válido
- [ ] Escutar evento `message:new`
- [ ] Escutar evento `error` para tratar token expirado
- [ ] Emitir `conversation:join` ao abrir conversa
- [ ] Emitir `conversation:leave` ao fechar conversa

### API REST
- [ ] Endpoint para enviar mensagem: `POST /api/messages`
- [ ] Endpoint para listar mensagens: `GET /api/messages/conversation/:id`
- [ ] Incluir `Authorization: Bearer {token}` em todas as requisições

### UI
- [ ] Mostrar mensagens recebidas em tempo real
- [ ] Atualizar UI quando receber `message:new`
- [ ] Mostrar indicador de "digitando..." (opcional)
- [ ] Mostrar status de entrega (opcional)

---

## ⚠️ Problemas Comuns

### 1. WebSocket Desconecta

**Causa:** Token JWT expirado

**Solução:**
```typescript
socket.on('error', (error) => {
  if (error.type === 'TOKEN_EXPIRED') {
    refreshToken().then(newToken => {
      socket.disconnect();
      connectWebSocket(newToken);
    });
  }
});
```

### 2. Mensagens Não Aparecem

**Verificar:**
- [ ] WebSocket está conectado?
- [ ] Token JWT está válido?
- [ ] Está escutando evento `message:new`?
- [ ] Emitiu `conversation:join`?

### 3. Mensagens Recebidas Não Aparecem

**Causa:** Webhook não está sendo chamado ou mensagem está sendo ignorada

**Soluções:**
- Mensagens de grupo não são suportadas
- Mensagens de mídia não são suportadas ainda
- Apenas mensagens de texto individuais funcionam

---

## 🎯 Resumo

1. **Conectar WebSocket** com token JWT válido
2. **Escutar `message:new`** para receber mensagens em tempo real
3. **Enviar mensagens** via API REST ou WebSocket
4. **Renovar token** antes de expirar (15 minutos)
5. **Tratar erros** de token expirado

**Pronto!** Seu chat em tempo real está funcionando! 🎉

