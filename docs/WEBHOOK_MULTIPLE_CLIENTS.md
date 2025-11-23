# Webhook - Múltiplos Clientes

## ✅ Sim! O Mesmo Webhook Recebe Mensagens de Múltiplos Clientes

O endpoint `POST /api/webhooks/evolution` recebe **todas as mensagens** de **todos os clientes** que enviam para a instância do WhatsApp configurada.

---

## 🔄 Como Funciona

### 1. Um Webhook, Múltiplos Clientes

**Cenário**: Você tem uma instância WhatsApp conectada e 3 clientes diferentes enviam mensagens:

```
Cliente A (5511999999999) → WhatsApp → Evolution API → Webhook → Backend
Cliente B (5511888888888) → WhatsApp → Evolution API → Webhook → Backend  
Cliente C (5511777777777) → WhatsApp → Evolution API → Webhook → Backend
```

**Todos passam pelo mesmo endpoint**: `POST /api/webhooks/evolution`

### 2. Processamento Individual

Para **cada mensagem recebida**, o sistema processa independentemente:

```typescript
// src/webhooks/webhooks.service.ts
async processEvolutionMessage(payload) {
  // 1. Extrai o telefone do remetente
  const contactPhone = normalizePhone(data.key.remoteJid);
  // Exemplo: "5511999999999@s.whatsapp.net" → "+5511999999999"
  
  // 2. Busca ou CRIA o contato no banco
  let contact = await findOrCreateContact(contactPhone);
  
  // 3. Busca ou CRIA a conversa para esse contato
  let conversation = await findOrCreateConversation(contact, instance);
  
  // 4. CRIA a mensagem no banco
  const message = await messagesService.receiveInbound({
    conversationId: conversation.id,
    content: messageText,
    externalId: data.key.id,
  });
  
  // 5. Emite via WebSocket para atualizar frontend
  chatGateway.emitNewMessage(conversation.id, message);
}
```

---

## 📊 Armazenamento no Banco de Dados

### Tabela `contacts`

**Uma entrada por telefone único**:

| id | name | phone | createdAt |
|----|------|-------|-----------|
| uuid-1 | João Silva | +5511999999999 | 2025-11-23 |
| uuid-2 | Maria Santos | +5511888888888 | 2025-11-23 |
| uuid-3 | Pedro Costa | +5511777777777 | 2025-11-23 |

**Regra**: Se o contato já existe (mesmo telefone), usa o existente. Se não, cria novo.

### Tabela `conversations`

**Uma conversa por contato (quando aberta)**:

| id | contactId | serviceInstanceId | operatorId | status | startTime |
|----|-----------|-------------------|------------|--------|-----------|
| conv-1 | uuid-1 | inst-1 | oper-1 | OPEN | 2025-11-23 10:00 |
| conv-2 | uuid-2 | inst-1 | null | OPEN | 2025-11-23 10:05 |
| conv-3 | uuid-3 | inst-1 | oper-2 | OPEN | 2025-11-23 10:10 |

**Regra**: 
- Se já existe conversa **aberta** (`status: OPEN`) para o contato, usa ela
- Se não existe, **cria nova conversa** e atribui operador (se disponível)

### Tabela `messages`

**Uma entrada por mensagem recebida/enviada**:

| id | conversationId | senderId | content | direction | externalId | createdAt |
|----|----------------|----------|---------|-----------|------------|-----------|
| msg-1 | conv-1 | null | "Olá" | INBOUND | evol-123 | 2025-11-23 10:00 |
| msg-2 | conv-1 | oper-1 | "Oi! Como posso ajudar?" | OUTBOUND | evol-124 | 2025-11-23 10:01 |
| msg-3 | conv-1 | null | "Preciso de ajuda" | INBOUND | evol-125 | 2025-11-23 10:02 |
| msg-4 | conv-2 | null | "Bom dia" | INBOUND | evol-126 | 2025-11-23 10:05 |
| msg-5 | conv-3 | null | "Olá" | INBOUND | evol-127 | 2025-11-23 10:10 |

**Regra**: Cada mensagem é salva individualmente, vinculada à conversa correta.

---

## 🎯 Exemplo Prático

### Cenário: 3 Clientes Enviam Mensagens

**10:00** - Cliente A (5511999999999) envia "Olá"
1. Webhook recebe: `{ instance: "Inicial", data: { key: { remoteJid: "5511999999999@s.whatsapp.net" }, message: { conversation: "Olá" } } }`
2. Sistema processa:
   - Cria contato: `{ phone: "+5511999999999", name: "Cliente A" }`
   - Cria conversa: `{ contactId: "uuid-1", operatorId: "oper-1" }`
   - Cria mensagem: `{ conversationId: "conv-1", content: "Olá", direction: "INBOUND" }`
3. WebSocket emite: `message:new` para operador-1

**10:05** - Cliente B (5511888888888) envia "Bom dia"
1. Webhook recebe: `{ instance: "Inicial", data: { key: { remoteJid: "5511888888888@s.whatsapp.net" }, message: { conversation: "Bom dia" } } }`
2. Sistema processa:
   - Cria contato: `{ phone: "+5511888888888", name: "Cliente B" }`
   - Cria conversa: `{ contactId: "uuid-2", operatorId: null }` (nenhum operador disponível)
   - Cria mensagem: `{ conversationId: "conv-2", content: "Bom dia", direction: "INBOUND" }`
3. Conversa entra na fila (sem operador)

**10:10** - Cliente C (5511777777777) envia "Olá"
1. Webhook recebe: `{ instance: "Inicial", data: { key: { remoteJid: "5511777777777@s.whatsapp.net" }, message: { conversation: "Olá" } } }`
2. Sistema processa:
   - Cria contato: `{ phone: "+5511777777777", name: "Cliente C" }`
   - Cria conversa: `{ contactId: "uuid-3", operatorId: "oper-2" }`
   - Cria mensagem: `{ conversationId: "conv-3", content: "Olá", direction: "INBOUND" }`
3. WebSocket emite: `message:new` para operador-2

**10:15** - Cliente A envia nova mensagem "Preciso de ajuda"
1. Webhook recebe: `{ instance: "Inicial", data: { key: { remoteJid: "5511999999999@s.whatsapp.net" }, message: { conversation: "Preciso de ajuda" } } }`
2. Sistema processa:
   - **Busca contato existente**: `{ phone: "+5511999999999" }` (já existe)
   - **Busca conversa aberta**: `{ contactId: "uuid-1", status: "OPEN" }` (já existe - conv-1)
   - **Cria nova mensagem**: `{ conversationId: "conv-1", content: "Preciso de ajuda", direction: "INBOUND" }`
3. WebSocket emite: `message:new` para operador-1 (mesma conversa)

---

## 🔑 Pontos Importantes

### 1. Identificação por Telefone

Cada cliente é identificado pelo **número de telefone**:
- Telefone é normalizado: `5511999999999` → `+5511999999999`
- Mesmo telefone = mesmo contato
- Contatos são únicos no banco

### 2. Conversas por Contato

- **Uma conversa aberta por contato** (por instância)
- Se o cliente já tem conversa aberta, novas mensagens vão para a mesma conversa
- Se não tem conversa aberta, cria nova

### 3. Distribuição Automática de Operadores

Quando uma nova conversa é criada:
- Sistema busca operadores online
- Ordena por quem está há mais tempo sem receber conversa
- Atribui automaticamente
- Se não houver operador disponível, conversa fica na fila (`operatorId: null`)

### 4. Mensagens Individuais

Cada mensagem é salva individualmente:
- Uma entrada na tabela `messages` por mensagem
- Vinculada à conversa correta
- Com `direction: INBOUND` (recebida) ou `OUTBOUND` (enviada)

---

## 📝 Resumo

✅ **Um webhook recebe mensagens de múltiplos clientes**

✅ **Cada mensagem é processada individualmente**

✅ **Contatos são criados automaticamente** (se não existirem)

✅ **Conversas são criadas automaticamente** (se não existirem)

✅ **Mensagens são salvas no banco** (uma por mensagem)

✅ **WebSocket atualiza frontend em tempo real**

✅ **Distribuição automática de operadores**

---

## 🔍 Verificação

Para verificar se está funcionando:

```sql
-- Ver contatos criados
SELECT * FROM contacts ORDER BY "createdAt" DESC;

-- Ver conversas criadas
SELECT * FROM conversations ORDER BY "startTime" DESC;

-- Ver mensagens recebidas
SELECT * FROM messages WHERE direction = 'INBOUND' ORDER BY "createdAt" DESC;
```

---

## ⚠️ Observações

1. **Mensagens Enviadas pelo Sistema**: O código ignora mensagens `fromMe: true` para evitar duplicação.

2. **Múltiplas Instâncias**: Se você tiver múltiplas instâncias, cada uma terá seu próprio webhook configurado, mas todas apontam para o mesmo endpoint `/api/webhooks/evolution`. O sistema identifica a instância pelo campo `instance` no payload.

3. **Performance**: O webhook processa mensagens sequencialmente. Se houver muitas mensagens simultâneas, pode haver um pequeno delay, mas todas serão processadas.

4. **Falhas**: Se houver erro ao processar uma mensagem (ex: contato inválido), o sistema loga o erro mas continua processando outras mensagens.

