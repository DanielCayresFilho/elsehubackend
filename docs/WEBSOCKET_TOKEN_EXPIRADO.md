# WebSocket: Token JWT Expirado

## 🚨 Problema

O frontend está tentando conectar ao WebSocket com um token JWT expirado, causando erro:

```
TokenExpiredError: jwt expired
```

## ✅ Solução

O frontend precisa **renovar o token antes de conectar ao WebSocket**.

### Passo a Passo

1. **Antes de conectar ao WebSocket**, verificar se o token está válido
2. **Se expirado**, usar o refresh token para obter um novo access token
3. **Conectar ao WebSocket** com o novo token

### Exemplo de Código (Frontend)

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  async connect(token: string, refreshToken: string) {
    // Verificar se token está expirado
    if (this.isTokenExpired(token)) {
      // Renovar token
      const newToken = await this.refreshAccessToken(refreshToken);
      this.token = newToken;
    } else {
      this.token = token;
    }

    // Conectar com token válido
    this.socket = io('wss://api.elsehub.covenos.com.br/chat', {
      auth: {
        token: this.token,
      },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket conectado');
    });

    this.socket.on('error', (error) => {
      if (error.type === 'TOKEN_EXPIRED') {
        // Renovar token e reconectar
        this.reconnect(refreshToken);
      }
    });
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Converter para milliseconds
      return Date.now() >= exp;
    } catch {
      return true; // Se não conseguir decodificar, considerar expirado
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch('https://api.elsehub.covenos.com.br/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Falha ao renovar token');
    }

    const data = await response.json();
    return data.accessToken;
  }

  private async reconnect(refreshToken: string) {
    if (this.socket) {
      this.socket.disconnect();
    }
    await this.connect(this.token!, refreshToken);
  }
}
```

### Verificar Token Antes de Conectar

```typescript
// Verificar se token está expirado (com margem de segurança de 5 minutos)
function isTokenExpired(token: string, marginMinutes = 5): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Converter para milliseconds
    const margin = marginMinutes * 60 * 1000; // 5 minutos em milliseconds
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

## 📋 Checklist

- [ ] Verificar se token está expirado antes de conectar
- [ ] Renovar token se expirado usando refresh token
- [ ] Conectar ao WebSocket com token válido
- [ ] Tratar evento `error` do WebSocket para reconectar se token expirar durante a conexão
- [ ] Implementar reconexão automática quando token expirar

## ⚠️ Importante

- O token JWT tem validade de **15 minutos** (900 segundos)
- O refresh token tem validade de **7 dias**
- Sempre verificar se o token está válido antes de conectar
- Implementar reconexão automática quando o token expirar durante a conexão

## 🔧 Backend

O backend agora emite um evento `error` com tipo `TOKEN_EXPIRED` quando detecta token expirado, facilitando o tratamento no frontend.

