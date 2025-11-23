# Como Diagnosticar se o Webhook Está Sendo Chamado

## 🔍 Verificação Rápida

### 1. Verificar Logs do Backend

Quando uma mensagem é recebida, você deve ver nos logs:

```
[WebhooksController] Webhook Evolution recebido
[WebhooksService] Webhook Evolution recebido: messages.upsert
[WebhooksService] Processando mensagem Evolution
```

**Se NÃO aparecer nada**: O webhook não está sendo chamado pela Evolution API.

**Se aparecer mas parar em algum ponto**: Verificar o log para ver onde está parando.

### 2. Verificar Status do Webhook na Evolution

```bash
curl -X GET "https://evolution.covenos.com.br/webhook/find/Inicial" \
  -H "apikey: xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp"
```

Deve retornar:
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

### 3. Testar Webhook Manualmente

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
        "conversation": "Teste manual do webhook"
      },
      "pushName": "Teste"
    }
  }'
```

Se funcionar, o backend está OK. O problema é a Evolution não chamando.

---

## 🚨 Problemas Comuns

### Problema 1: Webhook Não Está Sendo Chamado

**Sintomas:**
- Nenhum log aparece quando mensagem é recebida
- Status 200 no webhook mas nada acontece

**Soluções:**
1. Verificar se webhook está habilitado na Evolution
2. Verificar se URL está correta
3. Verificar se eventos estão habilitados
4. Verificar logs da Evolution API (se tiver acesso)

### Problema 2: Webhook É Chamado Mas Mensagem Não Aparece

**Sintomas:**
- Logs mostram webhook recebido
- Mas mensagem não é processada

**Possíveis Causas:**

#### A) Mensagem de Grupo
```
Mensagem Evolution de grupo ignorada (não suportado)
```
**Solução:** Grupos não são suportados. Apenas conversas individuais.

#### B) Mensagem de Mídia
```
Mensagem Evolution de mídia ignorada (não suportado ainda)
```
**Solução:** Mídia não é suportada ainda. Apenas texto.

#### C) Mensagem Sem Texto
```
Mensagem Evolution sem texto e sem mídia identificada, pulando...
```
**Solução:** Verificar o payload completo nos logs para entender o formato.

#### D) Mensagem fromMe = true
```
Mensagem ignorada: fromMe = true
```
**Solução:** Mensagens enviadas pelo sistema são ignoradas (já são processadas quando enviadas).

#### E) Instância Não Encontrada
```
Instância Evolution não encontrada: Inicial
```
**Solução:** Verificar se a instância existe no banco com o nome correto.

### Problema 3: Mensagem É Processada Mas Não Aparece no Frontend

**Sintomas:**
- Logs mostram "Mensagem Evolution processada com sucesso"
- Mas não aparece no frontend

**Soluções:**
1. Verificar se WebSocket está conectado
2. Verificar se token JWT não está expirado
3. Verificar se frontend está escutando evento `message:new`
4. Verificar se conversa está aberta no frontend

---

## 📋 Checklist de Diagnóstico

- [ ] Webhook está configurado na Evolution ✅
- [ ] URL do webhook está correta
- [ ] Eventos estão habilitados (MESSAGES_UPSERT, MESSAGES_UPDATE)
- [ ] Enviar mensagem do WhatsApp
- [ ] Verificar logs do backend (deve aparecer webhook recebido)
- [ ] Verificar se mensagem não é de grupo
- [ ] Verificar se mensagem não é mídia
- [ ] Verificar se mensagem tem texto
- [ ] Verificar se instância existe no banco
- [ ] Verificar se mensagem foi salva no banco
- [ ] Verificar se WebSocket emitiu a mensagem
- [ ] Verificar se frontend está conectado ao WebSocket
- [ ] Verificar se token JWT não está expirado

---

## 🔧 Logs Detalhados

Com os logs melhorados, você verá:

1. **Quando webhook é recebido:**
   ```
   [WebhooksController] Webhook Evolution recebido { event, instance, remoteJid, fromMe }
   ```

2. **Durante processamento:**
   ```
   [WebhooksService] Processando mensagem Evolution { instance, fromMe, remoteJid, messageType, messageKeys }
   [WebhooksService] Telefone normalizado: +5514991484962
   [WebhooksService] Texto extraído da mensagem: "Oi"
   ```

3. **Se houver problema:**
   ```
   [WebhooksService] Mensagem Evolution sem texto e sem mídia identificada, pulando...
   { messageKeys: [...], fullData: {...} }
   ```

---

## ⚠️ Importante

- **Grupos não são suportados** - apenas conversas individuais
- **Mídia não é suportada ainda** - apenas texto
- **Mensagens enviadas pelo sistema são ignoradas** - já são processadas quando enviadas
- **Webhook deve estar habilitado na Evolution** - verificar configuração

---

## 🎯 Próximos Passos

1. Enviar uma mensagem de texto individual do WhatsApp
2. Verificar logs do backend
3. Se webhook não for chamado, verificar configuração na Evolution
4. Se webhook for chamado mas mensagem não aparecer, verificar logs detalhados

