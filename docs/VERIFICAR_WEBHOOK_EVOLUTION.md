# Como Verificar e Corrigir Webhook da Evolution

## ✅ A URL está correta!

A URL `https://api.elsehub.covenos.com.br/api/webhooks/evolution` está correta. O problema é que a Evolution API não está chamando o webhook.

## 🔍 Passo 1: Verificar se o Webhook está Configurado

Execute este comando (substitua os valores):

```bash
curl -X GET "{serverUrl}/webhook/find/{instanceName}" \
  -H "apikey: {apiToken}"
```

**Exemplo:**
```bash
curl -X GET "https://evolution.covenos.com.br/webhook/find/vendas01" \
  -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp"
```

**Resposta esperada:**
```json
{
  "webhook": {
    "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
    "enabled": true,
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
  }
}
```

**Se retornar erro ou URL diferente**: O webhook não está configurado corretamente.

---

## 🔧 Passo 2: Reconfigurar o Webhook

Se o webhook não estiver configurado ou estiver com URL errada, execute:

```bash
curl -X POST "{serverUrl}/webhook/set/{instanceName}" \
  -H "apikey: {apiToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
    "enabled": true,
    "webhook_by_events": true,
    "webhook_base64": true,
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
  }'
```

**Exemplo:**
```bash
curl -X POST "https://evolution.covenos.com.br/webhook/set/vendas01" \
  -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.elsehub.covenos.com.br/api/webhooks/evolution",
    "enabled": true,
    "webhook_by_events": true,
    "webhook_base64": true,
    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
  }'
```

---

## 🧪 Passo 3: Testar o Endpoint do Backend

Teste se o endpoint do backend está funcionando:

```bash
curl -X POST https://api.elsehub.covenos.com.br/api/webhooks/evolution \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "{instanceName}",
    "data": {
      "key": {
        "remoteJid": "55149999255182@s.whatsapp.net",
        "fromMe": false,
        "id": "TEST123"
      },
      "message": {
        "conversation": "Teste manual do webhook"
      },
      "pushName": "Teste"
    }
  }'
```

**Se retornar `{"success": true}`**: O backend está funcionando! O problema é a Evolution não chamando.

**Se retornar erro**: Verifique os logs do backend.

---

## 📋 Checklist de Diagnóstico

- [ ] Webhook está configurado na Evolution (Passo 1)
- [ ] URL do webhook está correta: `https://api.elsehub.covenos.com.br/api/webhooks/evolution`
- [ ] Webhook está `enabled: true`
- [ ] Eventos estão habilitados: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`
- [ ] Endpoint do backend está acessível (Passo 3)
- [ ] Enviar mensagem do WhatsApp para o número
- [ ] Verificar logs do backend (deve aparecer "Webhook Evolution recebido")
- [ ] Se nada aparecer, Evolution não está chamando o webhook

---

## 🚨 Problemas Comuns

### Problema 1: Webhook não está configurado
**Solução**: Execute o Passo 2 para reconfigurar.

### Problema 2: Webhook está configurado mas não é chamado
**Possíveis causas:**
- Instância não está conectada no WhatsApp
- Firewall bloqueando requisições da Evolution para seu servidor
- SSL/TLS inválido ou expirado
- Evolution API não está enviando webhooks (bug da Evolution)

**Soluções:**
1. Verificar se a instância está conectada (QR Code escaneado)
2. Verificar logs da Evolution API (se tiver acesso)
3. Verificar se `https://api.elsehub.covenos.com.br` está acessível publicamente
4. Tentar desabilitar e habilitar o webhook novamente

### Problema 3: Backend não está recebendo
**Verificar:**
- Logs do backend devem mostrar: `[WebhooksController] Webhook Evolution recebido`
- Se não aparecer nada, a Evolution não está chamando
- Se aparecer mas parar, verificar logs para ver onde está parando

---

## 📝 Como Obter os Valores

### serverUrl
- URL do servidor da Evolution API (ex: `https://evolution.covenos.com.br`)

### instanceName
- Nome da instância configurada (ex: `vendas01`)
- Pode ser encontrado nas credenciais da instância no banco de dados

### apiToken
- Token de API da Evolution
- Pode ser encontrado nas credenciais da instância no banco de dados

---

## ⚠️ Importante

- A URL `https://api.elsehub.covenos.com.br/api/webhooks/evolution` está **correta**
- O problema é que a Evolution API não está chamando o webhook
- Verifique se a instância está conectada e funcionando
- Verifique se o webhook está habilitado na Evolution

