# Documentação Frontend - WebSocket e Mensagens em Tempo Real

## 📋 Resumo

O frontend **precisa** estar conectado ao WebSocket para receber mensagens em tempo real. Sem isso, as mensagens enviadas/recebidas não aparecerão automaticamente na interface.

---

## 🔌 Configuração do WebSocket

### URL de Conexão

```javascript
// URL base da API (ajuste conforme seu ambiente)
const WS_URL = 'wss://api.elsehub.covenos.com.br/chat';
// ou para desenvolvimento local:
// const WS_URL = 'ws://localhost:3000/chat';
```

### Autenticação

O WebSocket requer autenticação via JWT token. Você pode enviar de duas formas:

**Opção 1: Via Header (Recomendado)**
```javascript
const socket = io(WS_URL, {
  auth: {
    token: 'seu-jwt-token-aqui'
  },
  transports: ['websocket']
});
```

**Opção 2: Via Query Parameter**
```javascript
const socket = io(WS_URL, {
  query: {
    token: 'seu-jwt-token-aqui'
  },
  transports: ['websocket']
});
```

---

## 📡 Eventos que o Frontend DEVE Escutar

### 1. `message:new` - Nova Mensagem

**Quando**: Sempre que uma nova mensagem é enviada ou recebida.

**Payload**:
```json
{
  "id": "uuid-da-mensagem",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-operador-ou-null",
  "senderName": "Nome do Operador" ou null,
  "content": "Texto da mensagem",
  "direction": "INBOUND" ou "OUTBOUND",
  "via": "CHAT_MANUAL" ou "INBOUND" ou "CAMPAIGN",
  "externalId": "id-na-evolution-api",
  "status": "sent" ou "delivered" ou "read" ou "pending",
  "createdAt": "2025-11-23T20:00:00.000Z"
}
```

**Exemplo de Uso**:
```javascript
socket.on('message:new', (message) => {
  console.log('Nova mensagem recebida:', message);
  
  // Verificar se a mensagem é da conversa atual
  if (message.conversationId === currentConversationId) {
    // Adicionar mensagem à lista
    addMessageToUI(message);
    
    // Scroll para baixo
    scrollToBottom();
  }
});
```

### 2. `conversation:updated` - Conversa Atualizada

**Quando**: Quando uma conversa é atualizada (ex: operador atribuído).

**Payload**: Objeto `ConversationResponseDto`

**Exemplo de Uso**:
```javascript
socket.on('conversation:updated', (conversation) => {
  console.log('Conversa atualizada:', conversation);
  // Atualizar informações da conversa na UI
  updateConversationInfo(conversation);
});
```

### 3. `conversation:closed` - Conversa Fechada

**Quando**: Quando uma conversa é fechada.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Exemplo de Uso**:
```javascript
socket.on('conversation:closed', (data) => {
  console.log('Conversa fechada:', data.conversationId);
  // Atualizar status da conversa na UI
  markConversationAsClosed(data.conversationId);
});
```

### 4. `user:online` / `user:offline` - Status de Usuários

**Quando**: Quando um usuário conecta ou desconecta.

**Payload**:
```json
{
  "userId": "uuid-do-usuario",
  "email": "email@exemplo.com"
}
```

---

## 📤 Eventos que o Frontend PODE Enviar

### 1. `conversation:join` - Entrar na Sala da Conversa

**Quando**: Quando o usuário abre uma conversa.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Exemplo de Uso**:
```javascript
function openConversation(conversationId) {
  // Entrar na sala da conversa
  socket.emit('conversation:join', { conversationId });
  
  // Agora você receberá eventos dessa conversa
}

// Resposta do servidor
socket.on('conversation:join', (response) => {
  if (response.success) {
    console.log('Entrou na conversa:', response.conversation);
  }
});
```

### 2. `conversation:leave` - Sair da Sala da Conversa

**Quando**: Quando o usuário fecha/abandona uma conversa.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Exemplo de Uso**:
```javascript
function closeConversation(conversationId) {
  socket.emit('conversation:leave', { conversationId });
}
```

### 3. `message:send` - Enviar Mensagem (Opcional)

**Quando**: Para enviar mensagem via WebSocket (alternativa à API REST).

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Texto da mensagem"
}
```

**Exemplo de Uso**:
```javascript
function sendMessage(conversationId, content) {
  socket.emit('message:send', { conversationId, content }, (response) => {
    if (response.success) {
      console.log('Mensagem enviada:', response.message);
    } else {
      console.error('Erro ao enviar:', response.error);
    }
  });
}
```

**Nota**: Você também pode usar `POST /api/messages/send` via REST. O WebSocket é opcional para envio.

### 4. `typing:start` / `typing:stop` - Indicador de Digitação

**Quando**: Quando o usuário começa/para de digitar.

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa"
}
```

**Exemplo de Uso**:
```javascript
// Quando começar a digitar
input.addEventListener('input', () => {
  socket.emit('typing:start', { conversationId });
});

// Quando parar de digitar (debounce)
let typingTimeout;
input.addEventListener('input', () => {
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing:stop', { conversationId });
  }, 1000);
});

// Escutar quando outros estão digitando
socket.on('typing:user', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.userId, data.email);
  } else {
    hideTypingIndicator(data.userId);
  }
});
```

---

## 🔄 Fluxo Completo - Exemplo Prático

```javascript
import { io } from 'socket.io-client';

class ChatService {
  constructor() {
    this.socket = null;
    this.currentConversationId = null;
  }

  // Conectar ao WebSocket
  connect(token) {
    this.socket = io('wss://api.elsehub.covenos.com.br/chat', {
      auth: { token },
      transports: ['websocket']
    });

    // Eventos de conexão
    this.socket.on('connect', () => {
      console.log('Conectado ao WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('Desconectado do WebSocket');
      // Tentar reconectar após 3 segundos
      setTimeout(() => this.connect(token), 3000);
    });

    // Escutar novas mensagens
    this.socket.on('message:new', (message) => {
      this.handleNewMessage(message);
    });

    // Escutar atualizações de conversa
    this.socket.on('conversation:updated', (conversation) => {
      this.handleConversationUpdate(conversation);
    });

    // Escutar conversa fechada
    this.socket.on('conversation:closed', (data) => {
      this.handleConversationClosed(data.conversationId);
    });
  }

  // Abrir uma conversa
  openConversation(conversationId) {
    if (this.currentConversationId) {
      // Sair da conversa anterior
      this.socket.emit('conversation:leave', {
        conversationId: this.currentConversationId
      });
    }

    this.currentConversationId = conversationId;
    
    // Entrar na nova conversa
    this.socket.emit('conversation:join', { conversationId });
  }

  // Enviar mensagem (via API REST - recomendado)
  async sendMessage(conversationId, content) {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ conversationId, content })
    });

    if (response.ok) {
      const message = await response.json();
      // A mensagem será recebida via WebSocket também
      return message;
    } else {
      throw new Error('Erro ao enviar mensagem');
    }
  }

  // Handlers
  handleNewMessage(message) {
    // Verificar se é da conversa atual
    if (message.conversationId === this.currentConversationId) {
      // Adicionar à UI
      this.addMessageToUI(message);
    } else {
      // Mostrar notificação de nova mensagem em outra conversa
      this.showNotification(message);
    }
  }

  handleConversationUpdate(conversation) {
    // Atualizar informações da conversa na UI
    this.updateConversationInfo(conversation);
  }

  handleConversationClosed(conversationId) {
    // Marcar conversa como fechada
    this.markAsClosed(conversationId);
  }

  // Desconectar
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Uso
const chatService = new ChatService();

// Ao fazer login
chatService.connect(userToken);

// Ao abrir uma conversa
chatService.openConversation(conversationId);

// Ao enviar mensagem
await chatService.sendMessage(conversationId, 'Olá!');
```

---

## ✅ Checklist de Implementação

### Conexão
- [ ] Conectar ao WebSocket ao fazer login
- [ ] Enviar token JWT na autenticação
- [ ] Tratar desconexão e reconexão automática

### Conversas
- [ ] Entrar na sala ao abrir uma conversa (`conversation:join`)
- [ ] Sair da sala ao fechar uma conversa (`conversation:leave`)
- [ ] Escutar `conversation:updated` para atualizar informações
- [ ] Escutar `conversation:closed` para atualizar status

### Mensagens
- [ ] Escutar `message:new` para receber mensagens em tempo real
- [ ] Filtrar mensagens pela conversa atual
- [ ] Atualizar UI quando receber nova mensagem
- [ ] Mostrar notificação para mensagens de outras conversas

### Envio de Mensagens
- [ ] Enviar via API REST (`POST /api/messages/send`) - **Recomendado**
- [ ] OU enviar via WebSocket (`message:send`) - Opcional
- [ ] Mostrar mensagem na UI imediatamente (otimista)
- [ ] Atualizar quando receber confirmação via WebSocket

### Indicadores
- [ ] Implementar `typing:start/stop` para mostrar quando está digitando
- [ ] Escutar `typing:user` para mostrar quando outros estão digitando

---

## ⚠️ Problemas Comuns

### Mensagens Não Aparecem

**Causa**: Não está conectado ao WebSocket ou não está na sala da conversa.

**Solução**:
1. Verificar se está conectado: `socket.connected`
2. Verificar se entrou na sala: `socket.emit('conversation:join', { conversationId })`
3. Verificar se está escutando: `socket.on('message:new', ...)`

### Mensagens Duplicadas

**Causa**: Adicionando mensagem na UI tanto ao enviar quanto ao receber via WebSocket.

**Solução**: Adicionar mensagem apenas uma vez:
- Ou ao enviar (otimista) e ignorar quando receber via WebSocket
- Ou apenas quando receber via WebSocket

### Reconexão

**Causa**: Conexão WebSocket caiu.

**Solução**: Implementar reconexão automática:
```javascript
socket.on('disconnect', () => {
  setTimeout(() => {
    socket.connect();
    // Reentrar nas salas necessárias
    socket.emit('conversation:join', { conversationId });
  }, 3000);
});
```

---

## 📚 Bibliotecas Recomendadas

### Socket.IO Client

```bash
npm install socket.io-client
```

```javascript
import { io } from 'socket.io-client';
```

### Alternativas

- **Native WebSocket**: Funciona, mas requer mais código manual
- **SockJS**: Alternativa ao Socket.IO
- **ws**: Para Node.js (não para frontend)

---

## 🎯 Resumo Rápido

1. **Conectar** ao WebSocket ao fazer login
2. **Entrar na sala** ao abrir uma conversa (`conversation:join`)
3. **Escutar** `message:new` para receber mensagens
4. **Enviar** mensagens via API REST (ou WebSocket)
5. **Atualizar UI** quando receber eventos

**Sem WebSocket = Sem atualização em tempo real!**

