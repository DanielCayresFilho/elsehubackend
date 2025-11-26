# 🔧 Troubleshooting - Erro 400 ao Enviar Mensagens

## ❌ Problema: Erro 400 Bad Request ao enviar mensagem

```
POST https://api.elsehub.covenos.com.br/api/messages/send 400 (Bad Request)
```

---

## ✅ Como o Sistema Funciona

**IMPORTANTE**: O endpoint **NÃO precisa** da instância na URL. A instância é identificada automaticamente pela conversa.

### Fluxo de Envio

1. **Frontend envia**: `POST /api/messages/send` com `conversationId` e `content`
2. **Backend busca a conversa** (incluindo `serviceInstance`)
3. **Backend identifica a instância** automaticamente da conversa
4. **Backend envia** via Evolution API ou Meta API usando as credenciais da instância

### Endpoint

```
POST /api/messages/send
```

**Body**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Sua mensagem aqui"
}
```

**NÃO precisa passar**:
- ❌ `serviceInstanceId` na URL
- ❌ `serviceInstanceId` no body
- ❌ Credenciais da instância

---

## 🔍 Possíveis Causas do Erro 400

### 1. Conversa não encontrada

**Erro**: `404 Not Found` ou `400 Bad Request`

**Causa**: O `conversationId` não existe no banco de dados.

**Solução**:
- Verificar se o `conversationId` está correto
- Listar conversas: `GET /api/conversations`
- Verificar se a conversa foi criada corretamente

---

### 2. Conversa fechada

**Erro**: `400 Bad Request - Não é possível enviar mensagem para conversa fechada`

**Causa**: A conversa tem `status: CLOSED`.

**Solução**:
- Verificar status da conversa: `GET /api/conversations/:id`
- Se necessário, criar uma nova conversa para o contato

---

### 3. Instância de serviço inativa

**Erro**: `400 Bad Request - Instância de serviço inativa`

**Causa**: A instância vinculada à conversa está com `isActive: false`.

**Solução**:
```bash
# Verificar status da instância
GET /api/service-instances/:id

# Ativar a instância se necessário
PATCH /api/service-instances/:id
{
  "isActive": true
}
```

---

### 4. Conversa sem instância vinculada

**Erro**: `400 Bad Request - Conversa não possui instância de serviço vinculada`

**Causa**: A conversa tem `serviceInstanceId: null` ou a instância foi deletada.

**Solução**:
- Verificar se a conversa tem `serviceInstanceId`:
  ```bash
  GET /api/conversations/:id
  ```
- Se `serviceInstanceId` for `null`, criar uma nova conversa vinculada a uma instância ativa

---

### 5. Provedor não suportado

**Erro**: `400 Bad Request - Provedor não suportado`

**Causa**: A instância tem um `provider` que não é `EVOLUTION_API` ou `OFFICIAL_META`.

**Solução**:
- Verificar o `provider` da instância
- Corrigir se necessário

---

### 6. Erro ao enviar via Evolution/Meta API

**Erro**: `400 Bad Request - Falha ao enviar mensagem na Evolution API: ...`

**Causas possíveis**:
- Instância não conectada na Evolution API
- Credenciais incorretas
- Número de telefone inválido
- Evolution API offline

**Solução**:
- Verificar status da instância: `GET /api/service-instances/:id/qrcode`
- Verificar credenciais da instância
- Verificar logs do backend para mais detalhes

---

## 🔍 Como Debugar

### 1. Verificar a Conversa

```bash
GET /api/conversations/{conversationId}
```

**Verificar**:
- ✅ `status` deve ser `"OPEN"`
- ✅ `serviceInstanceId` não deve ser `null`
- ✅ `serviceInstance` deve existir e ter `isActive: true`

**Exemplo de resposta esperada**:
```json
{
  "id": "uuid-da-conversa",
  "status": "OPEN",
  "serviceInstanceId": "uuid-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "contactName": "João Silva",
  "contactPhone": "+5511999999999",
  ...
}
```

---

### 2. Verificar a Instância

```bash
GET /api/service-instances/{serviceInstanceId}
```

**Verificar**:
- ✅ `isActive` deve ser `true`
- ✅ `provider` deve ser `EVOLUTION_API` ou `OFFICIAL_META`
- ✅ `credentials` devem estar corretas

---

### 3. Verificar Logs do Backend

Os logs agora incluem informações detalhadas:

```
[Tentando enviar mensagem] userId=xxx conversationId=yyy
[Conversa encontrada] conversationId=yyy status=OPEN serviceInstanceId=zzz serviceInstanceActive=true
```

Se houver erro, os logs mostrarão exatamente qual validação falhou.

---

## ✅ Solução Recomendada

### Passo 1: Verificar se a conversa existe e tem instância

```javascript
// No frontend, antes de enviar mensagem
const conversation = await fetch(`/api/conversations/${conversationId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

console.log('Conversa:', conversation);
console.log('ServiceInstanceId:', conversation.serviceInstanceId);
console.log('ServiceInstanceName:', conversation.serviceInstanceName);

if (!conversation.serviceInstanceId) {
  console.error('❌ Conversa sem instância vinculada!');
  // Criar nova conversa ou corrigir
}
```

### Passo 2: Verificar se a instância está ativa

```javascript
if (conversation.serviceInstanceId) {
  const instance = await fetch(`/api/service-instances/${conversation.serviceInstanceId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());

  console.log('Instância:', instance);
  
  if (!instance.isActive) {
    console.error('❌ Instância inativa!');
    // Ativar instância ou usar outra
  }
}
```

### Passo 3: Enviar mensagem

```javascript
// Se tudo estiver OK, enviar mensagem
const response = await fetch('/api/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversationId: conversation.id,
    content: 'Sua mensagem aqui'
  })
});

if (!response.ok) {
  const error = await response.json();
  console.error('Erro ao enviar:', error);
}
```

---

## 📝 Checklist de Verificação

Antes de enviar mensagem, verificar:

- [ ] Conversa existe (`GET /api/conversations/:id` retorna 200)
- [ ] Conversa está `OPEN` (não `CLOSED`)
- [ ] Conversa tem `serviceInstanceId` (não `null`)
- [ ] Instância existe (`GET /api/service-instances/:id` retorna 200)
- [ ] Instância está `isActive: true`
- [ ] Instância tem `provider` válido (`EVOLUTION_API` ou `OFFICIAL_META`)
- [ ] Instância tem credenciais corretas
- [ ] Para Evolution API: instância está conectada (QR Code escaneado)

---

## 🆘 Se Nada Funcionar

1. **Verificar logs do backend** para ver a mensagem de erro exata
2. **Verificar se a conversa foi criada corretamente** quando a mensagem chegou
3. **Verificar se o frontend está recebendo** o evento `conversation:new` com todos os dados
4. **Testar via API diretamente** (Postman/curl) para isolar o problema

---

**Última atualização**: Janeiro 2025

