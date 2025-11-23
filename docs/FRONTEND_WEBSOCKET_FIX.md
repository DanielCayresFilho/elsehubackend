# Correção WebSocket - "io server disconnect"

## 🚨 Problema

O WebSocket conecta mas o servidor desconecta imediatamente:
```
✅ WebSocket conectado com sucesso!
❌ WebSocket desconectado. Motivo: io server disconnect
```

## 🔍 Causa

O frontend está enviando o token via `auth.token`, mas o backend estava procurando apenas em:
- `client.handshake.headers.authorization` (header)
- `client.handshake.query.token` (query)

**Faltava verificar**: `client.handshake.auth.token` (auth object)

## ✅ Correção Aplicada no Backend

O código foi atualizado para aceitar token de **3 formas**:

1. **Via auth object** (Socket.IO padrão) - `client.handshake.auth.token`
2. **Via header** - `Authorization: Bearer <token>`
3. **Via query** - `?token=<token>`

## 📋 Configuração Correta no Frontend

### Opção 1: Via auth (Recomendado) ✅

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://api.elsehub.covenos.com.br/chat', {
  auth: {
    token: 'seu-jwt-token-aqui'
  },
  transports: ['websocket'],
  reconnection: true
});
```

### Opção 2: Via Header

```javascript
const socket = io('wss://api.elsehub.covenos.com.br/chat', {
  extraHeaders: {
    'Authorization': 'Bearer seu-jwt-token-aqui'
  },
  transports: ['websocket']
});
```

### Opção 3: Via Query (Não recomendado)

```javascript
const socket = io('wss://api.elsehub.covenos.com.br/chat', {
  query: {
    token: 'seu-jwt-token-aqui'
  },
  transports: ['websocket']
});
```

## 🔧 Exemplo Completo Corrigido

```javascript
class WebSocketService {
  constructor(wsUrl, getToken) {
    this.wsUrl = wsUrl;
    this.getToken = getToken; // Função que retorna o token atual
    this.socket = null;
  }

  connect() {
    const token = this.getToken();
    
    if (!token) {
      console.error('Token não disponível');
      return;
    }

    // ✅ CORRETO: Usar auth.token
    this.socket = io(`${this.wsUrl}/chat`, {
      auth: {
        token: token
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Eventos
    this.socket.on('connect', () => {
      console.log('✅ WebSocket conectado');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket desconectado:', reason);
      
      // Se foi desconexão do servidor, pode ser token inválido
      if (reason === 'io server disconnect') {
        console.error('Servidor desconectou. Verifique se o token é válido.');
        // Tentar reconectar com novo token
        setTimeout(() => {
          const newToken = this.getToken();
          if (newToken) {
            this.connect();
          }
        }, 2000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro ao conectar:', error.message);
    });

    // Escutar mensagens
    this.socket.on('message:new', (message) => {
      console.log('📨 Nova mensagem:', message);
      this.handleNewMessage(message);
    });
  }

  joinConversation(conversationId) {
    if (!this.socket || !this.socket.connected) {
      console.error('WebSocket não está conectado');
      return;
    }

    this.socket.emit('conversation:join', { conversationId }, (response) => {
      if (response.success) {
        console.log('✅ Entrou na conversa');
      } else {
        console.error('❌ Erro:', response.error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Uso
const wsService = new WebSocketService(
  'wss://api.elsehub.covenos.com.br',
  () => localStorage.getItem('accessToken') // Função que retorna token
);

// Conectar ao fazer login
wsService.connect();

// Entrar na conversa
wsService.joinConversation(conversationId);
```

## ⚠️ Erro JavaScript: "token is not defined"

Se você está vendo este erro no frontend:

```javascript
Uncaught ReferenceError: token is not defined
```

**Causa**: Variável `token` não está definida no escopo.

**Correção**: Garantir que o token está acessível:

```javascript
// ❌ ERRADO
function setupEventListeners() {
  socket.on('disconnect', () => {
    console.log(token); // token não está definido aqui
  });
}

// ✅ CORRETO
function setupEventListeners(token) {
  socket.on('disconnect', () => {
    console.log('Token:', token);
  });
}

// OU usar closure
const token = getToken();
function setupEventListeners() {
  socket.on('disconnect', () => {
    console.log('Token:', token);
  });
}
```

## 🔍 Debugging

### Verificar se Token está Sendo Enviado

```javascript
socket.on('connect', () => {
  console.log('Socket conectado');
  console.log('Auth:', socket.auth);
  console.log('Headers:', socket.handshake.headers);
});
```

### Verificar Logs do Backend

Os logs do backend devem mostrar:
- `Cliente conectado: {socketId} (User: {userId})` - ✅ Sucesso
- `Cliente sem token tentou conectar` - ❌ Token não enviado
- `Erro ao conectar cliente: {erro}` - ❌ Token inválido/expirado

### Testar Token

```javascript
// Verificar se token é válido
async function testToken(token) {
  const response = await fetch('https://api.elsehub.covenos.com.br/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    console.log('✅ Token válido');
  } else {
    console.error('❌ Token inválido ou expirado');
  }
}
```

## 📝 Checklist

- [ ] Token está sendo enviado via `auth.token`
- [ ] Token não está expirado
- [ ] URL está correta: `wss://api.elsehub.covenos.com.br/chat`
- [ ] Backend foi atualizado (deploy feito)
- [ ] Não há erro JavaScript de variável não definida
- [ ] WebSocket está escutando eventos corretos

## 🎯 Resumo

1. **Backend corrigido**: Agora aceita token via `auth.token`
2. **Frontend deve usar**: `auth: { token: jwtToken }`
3. **Erro JavaScript**: Corrigir variável `token` não definida
4. **Deploy**: Fazer deploy do backend atualizado

Após o deploy, o WebSocket deve funcionar corretamente!

