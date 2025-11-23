# Problema: Mensagens Recebidas Não Aparecem no Frontend

## 🚨 Problema

- ✅ Mensagens **enviadas** aparecem no frontend
- ❌ Mensagens **recebidas** não aparecem no frontend
- ✅ WebSocket está conectado
- ✅ Entrou na sala da conversa

## 🔍 Diagnóstico

### Possíveis Causas

1. **Webhook não está sendo chamado** quando mensagem é recebida
2. **Webhook está ignorando mensagens** (`fromMe: true`)
3. **Webhook não está encontrando a conversa**
4. **Frontend não está escutando** o evento `message:new`

---

## ✅ Verificações no Backend

### 1. Verificar se Webhook está Configurado

```bash
curl -X GET "https://evolution.covenos.com.br/webhook/find/Inicial" \
  -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp"
```

**Deve retornar**:
```json
{
  "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
  "enabled": true,
  "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
}
```

### 2. Verificar Logs do Backend

Quando uma mensagem é recebida, os logs devem mostrar:

```
[WebhooksService] Webhook Evolution recebido: messages.upsert
[WebhooksService] Mensagem Evolution processada: {id}
[ChatGateway] Emitindo message:new para conversation: {id}
```

**Se não aparecer**: O webhook não está sendo chamado pela Evolution API.

### 3. Testar Webhook Manualmente

Você pode simular um webhook para testar:

```bash
curl -X POST https://api.elsehub.covenos.com.br/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "Inicial",
    "data": {
      "key": {
        "remoteJid": "5514991484962@s.whatsapp.net",
        "fromMe": false,
        "id": "TEST123"
      },
      "message": {
        "conversation": "Mensagem de teste"
      },
      "pushName": "Teste"
    }
  }'
```

**Se funcionar**: O webhook está OK, o problema é na Evolution API não chamando.

**Se não funcionar**: Verificar logs do backend para ver o erro.

---

## 🔧 Correções Possíveis

### Problema 1: Webhook Não Está Sendo Chamado

**Causa**: Evolution API não está enviando webhooks para o backend.

**Solução**: Verificar configuração do webhook na Evolution API:

1. Acessar Manager da Evolution API
2. Verificar se o webhook está configurado
3. Verificar se os eventos estão habilitados:
   - ✅ `MESSAGES_UPSERT` (obrigatório)
   - ✅ `MESSAGES_UPDATE` (opcional)
   - ✅ `CONNECTION_UPDATE` (opcional)

### Problema 2: Mensagens `fromMe: true` Estão Sendo Ignoradas

**Código atual**:
```typescript
if (data.key?.fromMe) {
  // Mensagem enviada pelo sistema, ignorar
  return;
}
```

**Problema**: Se você enviar uma mensagem e a Evolution retornar um webhook com `fromMe: true`, ela será ignorada.

**Solução**: Isso está correto! Mensagens enviadas pelo sistema não devem ser processadas como recebidas. Mas verifique se mensagens realmente recebidas têm `fromMe: false`.

### Problema 3: Conversa Não Está Sendo Encontrada

**Causa**: O webhook não encontra a conversa aberta.

**Verificação**: Verificar logs:
```
[WebhooksService] Instância Evolution não encontrada: {instance}
[WebhooksService] Conversa não encontrada para contato: {phone}
```

**Solução**: 
- Verificar se a instância está ativa
- Verificar se o `instanceName` na Evolution corresponde ao cadastrado
- Verificar se há conversa aberta para o contato

### Problema 4: Frontend Não Está Escutando

**Verificação no Frontend**:

```javascript
// Verificar se está escutando
socket.on('message:new', (message) => {
  console.log('📨 Nova mensagem recebida:', message);
  // Adicionar à UI
});

// Verificar se está na sala
socket.emit('conversation:join', { conversationId }, (response) => {
  console.log('Entrou na sala:', response);
});
```

---

## 🧪 Teste Completo

### Passo 1: Enviar Mensagem do WhatsApp para o Número

1. Pegue seu celular
2. Envie uma mensagem para o número da instância
3. Verifique os logs do backend

### Passo 2: Verificar Logs do Backend

```bash
# Ver logs em tempo real
docker logs -f <container-id> | grep -i "webhook\|evolution\|message"
```

**Deve aparecer**:
```
[WebhooksService] Webhook Evolution recebido: messages.upsert
[WebhooksService] Mensagem Evolution processada: {id}
[ChatGateway] Emitindo message:new
```

### Passo 3: Verificar no Frontend

No console do navegador:
```javascript
// Verificar se está escutando
socket.on('message:new', (msg) => {
  console.log('Mensagem recebida:', msg);
});
```

---

## 🔍 Debugging Avançado

### Adicionar Logs no Backend

Se necessário, adicionar mais logs:

```typescript
// src/webhooks/webhooks.service.ts
private async processEvolutionMessage(payload: EvolutionWebhookDto) {
  this.logger.log('=== PROCESSANDO MENSAGEM ===');
  this.logger.log('Payload:', JSON.stringify(payload, null, 2));
  
  // ... resto do código ...
  
  this.logger.log('Mensagem criada:', newMessage.id);
  this.logger.log('Emitindo para conversa:', conversation.id);
  this.chatGateway.emitNewMessage(conversation.id, newMessage);
  this.logger.log('=== MENSAGEM PROCESSADA ===');
}
```

### Verificar no Banco de Dados

```sql
-- Ver últimas mensagens recebidas
SELECT * FROM messages 
WHERE direction = 'INBOUND' 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Ver se mensagens estão sendo criadas
SELECT COUNT(*) FROM messages WHERE direction = 'INBOUND';
```

---

## 📋 Checklist de Verificação

### Backend
- [ ] Webhook está configurado na Evolution API
- [ ] URL do webhook está correta: `https://api.elsehub.covenos.com.br/api/webhooks/evolution`
- [ ] Eventos estão habilitados: `MESSAGES_UPSERT`
- [ ] Backend está recebendo webhooks (ver logs)
- [ ] Webhook está processando mensagens (ver logs)
- [ ] WebSocket está emitindo `message:new` (ver logs)

### Frontend
- [ ] WebSocket está conectado
- [ ] Está na sala da conversa (`conversation:join`)
- [ ] Está escutando `message:new`
- [ ] Está atualizando UI quando recebe mensagem

### Evolution API
- [ ] Instância está conectada
- [ ] Webhook está configurado
- [ ] Eventos estão habilitados
- [ ] Webhook está sendo chamado (ver logs da Evolution)

---

## 🎯 Solução Mais Provável

**O problema mais provável é**: A Evolution API não está enviando webhooks quando mensagens são recebidas.

**Verificar**:
1. Webhook está configurado? ✅ (já verificamos)
2. Evolution está chamando o webhook? ❓ (precisa verificar logs)
3. Backend está processando? ❓ (precisa verificar logs)

**Próximos passos**:
1. Enviar mensagem do WhatsApp para o número
2. Verificar logs do backend
3. Se não aparecer nada, o webhook não está sendo chamado
4. Verificar configuração na Evolution API

---

## ⚠️ Importante

**Mensagens enviadas aparecem** porque:
- Você envia via API REST
- Backend salva no banco
- Backend emite via WebSocket
- Frontend recebe

**Mensagens recebidas não aparecem** porque:
- Cliente envia no WhatsApp
- Evolution API recebe
- Evolution API **deve** chamar webhook
- Backend processa e emite
- Frontend recebe

**Se o webhook não for chamado**, as mensagens recebidas nunca aparecerão.

---

## 🔧 Configuração na Evolution API

Se o webhook não estiver funcionando, verificar:

1. **Manager da Evolution API**:
   - Acessar: `https://evolution.covenos.com.br/manager`
   - Ir em "Webhooks" ou "Configurações"
   - Verificar se está configurado

2. **Via API**:
   ```bash
   curl -X GET "https://evolution.covenos.com.br/webhook/find/Inicial" \
     -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp"
   ```

3. **Reconfigurar se necessário**:
   ```bash
   curl -X POST "https://evolution.covenos.com.br/webhook/set/Inicial" \
     -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp" \
     -H "Content-Type: application/json" \
     -d '{
       "webhook": {
         "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
         "enabled": true,
         "webhook_by_events": true,
         "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
       }
     }'
   ```

---

## 📝 Resumo

1. **Backend está correto** - O código processa e emite via WebSocket
2. **Problema provável**: Evolution API não está chamando o webhook
3. **Solução**: Verificar/reativar webhook na Evolution API
4. **Teste**: Enviar mensagem do WhatsApp e verificar logs

**Não precisa alterar nada na Evolution além de verificar se o webhook está configurado e ativo!**

