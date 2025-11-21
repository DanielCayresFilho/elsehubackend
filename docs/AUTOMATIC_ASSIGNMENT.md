# Sistema de Atribuição Automática de Conversas

Documentação completa do sistema automático de distribuição de conversas para operadores online.

---

## 🎯 Visão Geral

O sistema implementa atribuição **inteligente e automática** de conversas para operadores que estão online e disponíveis, seguindo regras de distribuição justa baseadas em tempo de inatividade.

---

## 📊 Funcionalidades Implementadas

### 1. Status Online/Offline
- **Operadores** podem se marcar como online/offline
- Apenas operadores **online** recebem conversas automaticamente
- Sistema rastreia tempo desde que ficou online
- Rastreia última atribuição de conversa

### 2. Distribuição Automática
- Nova mensagem de cliente → Sistema busca operador disponível
- **Critério de seleção:** Operador online há mais tempo SEM receber conversa
- Se nenhum operador online → Conversa vai para fila de espera
- Timestamp atualizado automaticamente após atribuição

### 3. Isolamento por Operador
- **OPERATOR:** Só vê suas próprias conversas
- **SUPERVISOR/ADMIN:** Vê todas as conversas
- Filtro automático aplicado nas listagens

### 4. Expiração Automática (24h)
- Job roda **a cada hora** verificando conversas antigas
- Conversa sem atividade há **24 horas** → Fecha automaticamente
- Tabulação automática: **"Conversa Expirada"**
- Cliente que volta → **Nova conversa** criada automaticamente

### 5. Reativação Inteligente
- Cliente expirado retorna → Não reabre conversa antiga
- Sistema cria **nova conversa** do zero
- Nova conversa vai para operador disponível (mesma lógica)

---

## 🔄 Fluxo Completo

```
1. Operador faz login
   ↓
2. Operador se marca como ONLINE
   PATCH /api/users/me/toggle-online { isOnline: true }
   ↓
3. Webhook recebe mensagem de cliente novo
   ↓
4. Sistema busca operador disponível:
   - Online: true
   - Ativo: true
   - Role: OPERATOR ou SUPERVISOR
   - Ordenado por: lastConversationAssignedAt ASC
   ↓
5. Conversa criada e atribuída automaticamente
   ↓
6. Timestamp do operador atualizado
   ↓
7. Cliente e Operador conversam via WebSocket
   ↓
8. Após 24h sem atividade → Job expira automaticamente
   ↓
9. Se cliente voltar → Nova conversa criada
```

---

## 🛠️ Endpoints Novos

### Toggle Status Online

**`PATCH /api/users/me/toggle-online`**

**Role:** OPERATOR, SUPERVISOR, ADMIN

**Body:**
```json
{
  "isOnline": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "João Operador",
  "email": "joao@exemplo.com",
  "role": "OPERATOR",
  "active": true,
  "isOnline": true,
  "onlineSince": "2025-11-21T10:00:00Z",
  "lastConversationAssignedAt": null,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-11-21T10:00:00Z"
}
```

### Listar Operadores Online

**`GET /api/users/online`**

**Role:** SUPERVISOR, ADMIN

**Response:**
```json
[
  {
    "id": "uuid-1",
    "name": "João",
    "email": "joao@exemplo.com",
    "isOnline": true,
    "onlineSince": "2025-11-21T09:00:00Z",
    "lastConversationAssignedAt": null
  },
  {
    "id": "uuid-2",
    "name": "Maria",
    "email": "maria@exemplo.com",
    "isOnline": true,
    "onlineSince": "2025-11-21T08:00:00Z",
    "lastConversationAssignedAt": "2025-11-21T10:30:00Z"
  }
]
```

**Nota:** Lista está ordenada por `lastConversationAssignedAt` ASC (próximo a receber)

---

## 📐 Algoritmo de Distribuição

### Critérios de Seleção (em ordem):

1. **Status Online:** `isOnline = true`
2. **Usuário Ativo:** `active = true`
3. **Role Válida:** `OPERATOR` ou `SUPERVISOR`
4. **Ordenação:** `lastConversationAssignedAt ASC NULLS FIRST`

### Lógica de Priorização:

```sql
-- Operadores que NUNCA receberam conversa (null) vêm primeiro
-- Depois, os que receberam há mais tempo
-- Garante distribuição justa

SELECT * FROM users
WHERE isOnline = true
  AND active = true
  AND role IN ('OPERATOR', 'SUPERVISOR')
ORDER BY lastConversationAssignedAt ASC NULLS FIRST
LIMIT 1
```

---

## ⏰ Job de Expiração

### Configuração

- **Frequência:** A cada hora (`@Cron(CronExpression.EVERY_HOUR)`)
- **Tempo de expiração:** 24 horas sem atividade
- **Base de cálculo:** Última mensagem recebida/enviada

### Lógica

```typescript
// Busca conversas abertas há mais de 24h
const twentyFourHoursAgo = new Date();
twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

// Conversas OPEN com startTime < 24h atrás
const expiredConversations = conversations.where({
  status: 'OPEN',
  lastActivity: { lt: twentyFourHoursAgo }
});

// Para cada uma:
// 1. Cria registro em FinishedConversation
// 2. Status -> CLOSED
// 3. Tabulação -> "Conversa Expirada"
```

### Tabulação Automática

- **Nome:** `Conversa Expirada`
- **isAutomatic:** `true`
- **Criada automaticamente** se não existir
- **Não pode ser deletada** (possui conversas associadas)

---

## 🔒 Isolamento de Conversas

### Regras por Role:

**OPERATOR:**
```typescript
// Vê APENAS suas próprias conversas
where: {
  operatorId: user.userId
}
```

**SUPERVISOR/ADMIN:**
```typescript
// Vê TODAS as conversas
where: {
  // Sem filtro de operador
}
```

### Aplicado em:

- ✅ `GET /api/conversations`
- ✅ Listagens de mensagens (indireto via conversa)
- ✅ WebSocket (operador só entra em salas próprias)

---

## 🎮 Como Usar (Frontend)

### 1. Operador Faz Login

```javascript
// Login normal
const { accessToken, user } = await login(email, password);

// Se role === OPERATOR, marcar como online automaticamente
if (user.role === 'OPERATOR') {
  await toggleOnline(true);
}
```

### 2. Toggle Online/Offline

```javascript
async function toggleOnline(isOnline: boolean) {
  const response = await fetch('/api/users/me/toggle-online', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isOnline })
  });
  
  return response.json();
}
```

### 3. Conectar WebSocket (Se Online)

```javascript
if (isOnline) {
  const socket = io('ws://localhost:3000/chat', {
    extraHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Aguardar notificações de novas conversas
  socket.on('conversation:updated', (conversation) => {
    if (conversation.operatorId === user.id) {
      // Nova conversa atribuída!
      showNotification(`Nova conversa: ${conversation.contactName}`);
      
      // Entrar na sala automaticamente
      socket.emit('conversation:join', {
        conversationId: conversation.id
      });
    }
  });
}
```

### 4. Listar Apenas Minhas Conversas

```javascript
// Para OPERATOR, backend já filtra automaticamente
const myConversations = await fetch('/api/conversations', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 5. Logout/Pausa - Marcar Offline

```javascript
// Ao fazer logout ou pausar atendimento
await toggleOnline(false);

// Desconectar WebSocket
socket.disconnect();
```

---

## 📝 Schema Prisma Atualizado

```prisma
model User {
  // ... campos existentes
  
  // Novos campos
  isOnline                   Boolean   @default(false)
  onlineSince                DateTime?
  lastConversationAssignedAt DateTime?
}

model Tabulation {
  // ... campos existentes
  
  // Novo campo
  isAutomatic Boolean @default(false)
}
```

---

## 🚀 Migrations Necessárias

```bash
# Gerar migration
npx prisma migrate dev --name add_automatic_assignment

# Aplicar em produção
npx prisma migrate deploy
```

---

## 📊 Monitoramento

### Métricas Importantes:

1. **Operadores Online** - `GET /api/users/online`
2. **Conversas na Fila** - `GET /api/conversations/queue`
3. **Conversas Expiradas** - Filtrar por tabulação "Conversa Expirada"
4. **Distribuição por Operador** - `GET /api/reports/operator-performance`

### Logs a Observar:

```
✅ "Conversa atribuída automaticamente ao operador: João"
⚠️  "Nenhum operador online disponível. Conversa entrará na fila."
📊 "5 conversas expiradas automaticamente"
```

---

## ⚡ Performance

- **Índices necessários:**
  - `users.isOnline`
  - `users.lastConversationAssignedAt`
  - `conversations.startTime`
  - `conversations.status`

- **Otimizações:**
  - Query de operador disponível usa `LIMIT 1`
  - Job de expiração roda apenas 1x/hora
  - Cálculo de TMA/TME apenas no fechamento

---

## 🔮 Melhorias Futuras

- [ ] Priorização por habilidade/departamento
- [ ] Load balancing avançado (considerar carga atual)
- [ ] Reatribuição automática se operador ficar offline
- [ ] Tempo de expiração configurável por instância
- [ ] Notificações push para operadores
- [ ] Dashboard de distribuição em tempo real

---

**Versão:** 2.0.0  
**Última atualização:** 21/11/2025

