# Como Verificar se Mensagens Recebidas Estão Funcionando

## 🚨 Problema

Mensagens **enviadas** aparecem, mas mensagens **recebidas** não aparecem.

## ✅ Verificação Rápida

### 1. Enviar Mensagem do WhatsApp

1. Pegue seu celular
2. Envie uma mensagem para o número da instância (o número conectado na Evolution)
3. **Aguarde alguns segundos**

### 2. Verificar Logs do Backend

Os logs devem mostrar:

```
[WebhooksController] Webhook Evolution recebido
[WebhooksService] Webhook Evolution recebido: messages.upsert
[WebhooksService] Processando mensagem Evolution
[WebhooksService] Mensagem Evolution processada com sucesso: {id}
[ChatGateway] Emitindo mensagem via WebSocket
```

**Se NÃO aparecer nada**: O webhook não está sendo chamado pela Evolution API.

**Se aparecer mas não emitir**: Verificar erro nos logs.

### 3. Verificar no Banco de Dados

```sql
-- Ver últimas mensagens recebidas
SELECT * FROM messages 
WHERE direction = 'INBOUND' 
ORDER BY "createdAt" DESC 
LIMIT 5;
```

**Se não houver mensagens INBOUND**: O webhook não está processando.

**Se houver mensagens INBOUND**: O problema pode ser no frontend não recebendo via WebSocket.

---

## 🔧 O Que Verificar na Evolution API

### 1. Webhook Está Configurado? ✅

Já verificamos - está configurado corretamente:
- URL: `https://api.elsehub.covenos.com.br/api/webhooks/evolution`
- Enabled: `true`
- Events: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`

### 2. Evolution Está Chamando o Webhook?

**Verificar logs da Evolution API** (se tiver acesso):
- Deve mostrar chamadas para o webhook quando mensagens são recebidas

**Ou testar manualmente**:
```bash
# Simular webhook
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
        "conversation": "Teste manual"
      },
      "pushName": "Teste"
    }
  }'
```

Se funcionar, o backend está OK. O problema é a Evolution não chamando.

---

## 🎯 Solução Mais Provável

**A Evolution API pode não estar enviando webhooks para mensagens recebidas.**

### Verificar na Evolution API

1. **Acessar Manager da Evolution**:
   - URL: `https://evolution.covenos.com.br/manager`
   - Verificar se a instância está conectada
   - Verificar logs de webhook

2. **Verificar se Webhook Está Ativo**:
   - Algumas versões da Evolution precisam que o webhook seja reativado
   - Tentar desabilitar e habilitar novamente

3. **Verificar Eventos**:
   - O evento `MESSAGES_UPSERT` deve estar habilitado
   - Verificar se não há filtros que bloqueiam mensagens

### Reconfigurar Webhook (Se Necessário)

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

## 📋 Checklist

- [ ] Webhook está configurado na Evolution ✅
- [ ] Enviar mensagem do WhatsApp para o número
- [ ] Verificar logs do backend (deve aparecer webhook recebido)
- [ ] Verificar banco de dados (deve ter mensagem INBOUND)
- [ ] Verificar frontend (deve receber via WebSocket)
- [ ] Se nada aparecer, Evolution não está chamando webhook

---

## ⚠️ Importante

**Não precisa alterar nada na Evolution além de verificar se o webhook está ativo e sendo chamado.**

O backend está correto e processando webhooks quando recebidos. O problema é que a Evolution API pode não estar enviando webhooks para mensagens recebidas.

**Próximo passo**: Enviar uma mensagem do WhatsApp e verificar os logs do backend para confirmar se o webhook está sendo chamado.

