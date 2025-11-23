# Guia de Troubleshooting - Frontend WebSocket e Mensagens

## 🚨 Problemas Identificados

### 1. ❌ Erro 502 Bad Gateway no WebSocket

**Erro**:
```
GET wss://api.elsehub.covenos.com.br/chat/socket.io/?EIO=4&transport=websocket
[HTTP/1.1 502 Bad Gateway]
```

**Causa**: Problema de **infraestrutura/proxy reverso**. O WebSocket não está sendo roteado corretamente.

**Soluções**:

#### A. Verificar se o Backend está Rodando

```bash
# Verificar se a aplicação está rodando
curl https://api.elsehub.covenos.com.br/api/health
```

#### B. Configurar Proxy Reverso para WebSocket

Se você está usando **Coolify**, **Nginx** ou outro proxy reverso, precisa configurar para passar WebSocket:

**Nginx**:
```nginx
location /chat {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}
```

**Coolify**: Verificar se o proxy está configurado para WebSocket. Pode precisar adicionar headers de upgrade.

#### C. Verificar Porta e URL

O WebSocket deve estar na mesma URL base da API, mas com o namespace `/chat`:

```
API REST:  https://api.elsehub.covenos.com.br/api/...
WebSocket: wss://api.elsehub.covenos.com.br/chat
```

---

### 2. ❌ Erro 404 nos Endpoints de Mensagens

**Erro**:
```
GET /api/conversations/d9a1e615-97a6-4f48-92e8-f0093f3527ed/messages
[HTTP/3 404]

GET /api/messages?conversationId=...
[HTTP/3 404]
```

**Causa**: O frontend está usando **endpoints incorretos**.

**Endpoint Correto**:
```
GET /api/messages/conversation/:conversationId
```

**Correção no Frontend**:

```javascript
// ❌ ERRADO
fetch(`/api/conversations/${conversationId}/messages`)
fetch(`/api/messages?conversationId=${conversationId}`)

// ✅ CORRETO
fetch(`/api/messages/conversation/${conversationId}`)
```

**Exemplo Completo**:
```javascript
async function loadMessages(conversationId) {
  const response = await fetch(
    `https://api.elsehub.covenos.com.br/api/messages/conversation/${conversationId}?page=1&limit=100`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  if (response.ok) {
    const data = await response.json();
    return data.data; // Array de mensagens
  } else {
    throw new Error('Erro ao carregar mensagens');
  }
}
```

---

## ✅ Configuração Correta do WebSocket

### URL e Namespace

```javascript
import { io } from 'socket.io-client';

const WS_URL = 'wss://api.elsehub.covenos.com.br';
const WS_NAMESPACE = '/chat';

// Conectar
const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
  auth: {
    token: 'seu-jwt-token'
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});
```

### Autenticação

O WebSocket requer autenticação via JWT. Duas formas:

**Opção 1: Via auth (Recomendado)**
```javascript
const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
  auth: {
    token: jwtToken
  }
});
```

**Opção 2: Via query**
```javascript
const socket = io(`${WS_URL}${WS_NAMESPACE}`, {
  query: {
    token: jwtToken
  }
});
```

---

## 📋 Endpoints Corretos

### Mensagens

| Ação | Método | Endpoint | Status |
|------|--------|----------|--------|
| Enviar mensagem | POST | `/api/messages/send` | ✅ |
| Listar mensagens de uma conversa | GET | `/api/messages/conversation/:conversationId` | ✅ |
| Buscar mensagem por ID | GET | `/api/messages/:id` | ✅ |

### Conversas

| Ação | Método | Endpoint | Status |
|------|--------|----------|--------|
| Criar conversa | POST | `/api/conversations` | ✅ |
| Listar conversas | GET | `/api/conversations` | ✅ |
| Buscar conversa | GET | `/api/conversations/:id` | ✅ |
| Atribuir operador | PATCH | `/api/conversations/:id/assign` | ✅ |
| Fechar conversa | POST | `/api/conversations/:id/close` | ✅ |
| Fila de conversas | GET | `/api/conversations/queue` | ✅ |

**❌ NÃO EXISTEM**:
- `/api/conversations/:id/messages` - **NÃO EXISTE**
- `/api/messages?conversationId=...` - **NÃO EXISTE**

---

## 🔧 Implementação Correta - Exemplo Completo

### 1. Serviço de Mensagens

```javascript
class MessagesService {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  // ✅ CORRETO: Listar mensagens de uma conversa
  async getMessagesByConversation(conversationId, page = 1, limit = 100) {
    const response = await fetch(
      `${this.apiUrl}/api/messages/conversation/${conversationId}?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data; // { data: [...], meta: {...} }
  }

  // ✅ CORRETO: Enviar mensagem
  async sendMessage(conversationId, content) {
    const response = await fetch(`${this.apiUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId,
        content
      })
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

### 2. Serviço de WebSocket

```javascript
class WebSocketService {
  constructor(wsUrl, token) {
    this.wsUrl = wsUrl;
    this.token = token;
    this.socket = null;
    this.currentConversationId = null;
  }

  connect() {
    // ✅ CORRETO: URL com namespace
    this.socket = io(`${this.wsUrl}/chat`, {
      auth: {
        token: this.token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Eventos de conexão
    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket desconectado');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro ao conectar WebSocket:', error);
    });

    // Escutar novas mensagens
    this.socket.on('message:new', (message) => {
      console.log('📨 Nova mensagem:', message);
      this.onNewMessage(message);
    });
  }

  joinConversation(conversationId) {
    if (!this.socket || !this.socket.connected) {
      console.error('WebSocket não está conectado');
      return;
    }

    // Sair da conversa anterior
    if (this.currentConversationId) {
      this.socket.emit('conversation:leave', {
        conversationId: this.currentConversationId
      });
    }

    // Entrar na nova conversa
    this.currentConversationId = conversationId;
    this.socket.emit('conversation:join', { conversationId }, (response) => {
      if (response.success) {
        console.log('✅ Entrou na conversa:', conversationId);
      } else {
        console.error('❌ Erro ao entrar na conversa:', response.error);
      }
    });
  }

  onNewMessage(message) {
    // Implementar lógica para atualizar UI
    // Ex: adicionar mensagem à lista, scroll, etc.
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
```

### 3. Uso no Componente

```javascript
// No seu componente Vue/React/etc
const apiUrl = 'https://api.elsehub.covenos.com.br';
const token = localStorage.getItem('token');

// Inicializar serviços
const messagesService = new MessagesService(apiUrl, token);
const wsService = new WebSocketService(apiUrl, token);

// Conectar WebSocket ao montar componente
onMounted(() => {
  wsService.connect();
});

// Carregar mensagens ao abrir conversa
async function openConversation(conversationId) {
  // 1. Carregar mensagens via API REST
  const messagesData = await messagesService.getMessagesByConversation(conversationId);
  messages.value = messagesData.data;
  
  // 2. Entrar na sala do WebSocket
  wsService.joinConversation(conversationId);
  
  // 3. Escutar novas mensagens
  wsService.onNewMessage = (message) => {
    if (message.conversationId === conversationId) {
      messages.value.push(message);
    }
  };
}

// Enviar mensagem
async function sendMessage(conversationId, content) {
  try {
    const message = await messagesService.sendMessage(conversationId, content);
    // A mensagem será recebida via WebSocket também
    // Mas você pode adicionar otimisticamente
    messages.value.push(message);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}
```

---

## 🔍 Checklist de Verificação

### Backend
- [ ] Backend está rodando e acessível
- [ ] Endpoint `/api/health` responde
- [ ] WebSocket está configurado no `main.ts` (deve estar automático)
- [ ] Proxy reverso está configurado para WebSocket (upgrade headers)

### Frontend - Endpoints
- [ ] Usa `/api/messages/conversation/:id` (não `/api/conversations/:id/messages`)
- [ ] Usa `/api/messages/send` para enviar
- [ ] Headers de autenticação estão corretos

### Frontend - WebSocket
- [ ] URL está correta: `wss://api.elsehub.covenos.com.br/chat`
- [ ] Token JWT está sendo enviado via `auth.token`
- [ ] Está escutando `message:new`
- [ ] Está entrando na sala: `conversation:join`
- [ ] Tratando erros de conexão

---

## 🐛 Debugging

### Verificar se WebSocket está Funcionando

```javascript
// No console do navegador
socket.on('connect', () => console.log('✅ Conectado'));
socket.on('disconnect', () => console.log('❌ Desconectado'));
socket.on('connect_error', (err) => console.error('❌ Erro:', err));
socket.on('message:new', (msg) => console.log('📨 Mensagem:', msg));
```

### Verificar Endpoints

```javascript
// Testar endpoint de mensagens
fetch('https://api.elsehub.covenos.com.br/api/messages/conversation/SEU-ID', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Logs do Backend

Verifique os logs do backend para ver se:
- WebSocket está recebendo conexões
- Mensagens estão sendo processadas
- Erros estão sendo logados

---

## 📝 Resumo das Correções Necessárias

### 1. Endpoint de Mensagens

**Trocar**:
```javascript
// ❌ ERRADO
`/api/conversations/${id}/messages`
`/api/messages?conversationId=${id}`
```

**Por**:
```javascript
// ✅ CORRETO
`/api/messages/conversation/${id}`
```

### 2. WebSocket - 502 Bad Gateway

**Problema**: Proxy reverso não está configurado para WebSocket.

**Solução**: Configurar proxy para passar WebSocket (ver seção acima).

**Alternativa Temporária**: Se não conseguir configurar o proxy, você pode:
- Usar polling ao invés de WebSocket (não recomendado)
- Aguardar configuração do proxy

### 3. WebSocket - URL

**Verificar**:
- URL base: `wss://api.elsehub.covenos.com.br`
- Namespace: `/chat`
- URL completa: `wss://api.elsehub.covenos.com.br/chat`

---

## ⚠️ Importante

1. **502 Bad Gateway** = Problema de infraestrutura, não de código
2. **404 nos endpoints** = Frontend usando endpoints errados
3. **WebSocket não conecta** = Pode ser proxy ou backend não rodando

**Prioridade**:
1. Corrigir endpoints no frontend (404)
2. Configurar proxy para WebSocket (502)
3. Testar conexão WebSocket

