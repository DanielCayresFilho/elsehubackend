# Documentação de Integração Frontend

Este documento descreve os endpoints e payloads esperados pelo backend, atualizados com as correções recentes.

## 1. Usuários (`/users`)

### Criar Usuário (`POST /users`)
**Payload:**
```json
{
  "name": "Nome do Usuário",
  "email": "email@exemplo.com",
  "password": "senha_segura",
  "role": "OPERATOR", // ADMIN, SUPERVISOR, OPERATOR
  "isActive": true // OBRIGATÓRIO: usar "isActive" e não "active"
}
```

### Atualizar Usuário (`PATCH /users/:id`)
**Payload:**
```json
{
  "name": "Novo Nome",
  "role": "ADMIN",
  "isActive": false
}
```
*Nota: `isActive` é o campo correto para ativar/desativar.*

### Deletar Usuário (`DELETE /users/:id`)
Remove um usuário permanentemente. Requer permissão de `ADMIN`.
**Resposta:** Status 200 OK.

---

## 2. Instâncias de Serviço (`/service-instances`)

### Criar Instância (`POST /service-instances`)
**Payload (Evolution API):**
```json
{
  "name": "Minha Instância Evolution",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://api.evolution.com",
    "instanceName": "minha_instancia_01",
    "apiToken": "seu_token_aqui"
  }
}
```

**Payload (Meta Oficial):**
```json
{
  "name": "WhatsApp Oficial",
  "provider": "OFFICIAL_META",
  "credentials": {
    "wabaId": "123456...",
    "phoneId": "987654...",
    "accessToken": "EAAG..."
  }
}
```

### Obter QR Code (`GET /service-instances/:id/qrcode`)
Este endpoint retorna o QR Code (base64) para instâncias da Evolution API.
**Resposta Sucesso:**
```json
{
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```
**Resposta Instância já Conectada:**
```json
{
  "message": "Instância já conectada"
}
```
*Uso no Frontend:* Exibir em uma tag `<img src="{response.base64}" />`.

---

## 3. Tabulações (`/tabulations`)

### Criar Tabulação (`POST /tabulations`)
**Payload:**
```json
{
  "name": "Venda Concluída"
}
```
*Nota: Campos como `description`, `color`, `active` foram removidos.*

---

## 4. Templates (`/templates`)

### Criar Template (`POST /templates`)
**Payload:**
```json
{
  "name": "Boas Vindas",
  "body": "Olá {{name}}, tudo bem?",
  "serviceInstanceId": "uuid-da-instancia",
  "language": "pt_BR", // Opcional
  "metaTemplateId": "template_123", // Opcional, se usar Meta
  "variables": {} // Opcional
}
```

---

## 5. Campanhas (`/campaigns`)

### Criar Campanha (`POST /campaigns`)
**Payload:**
```json
{
  "name": "Disparo de Promoção",
  "serviceInstanceId": "uuid-da-instancia",
  "templateId": "uuid-do-template", // Opcional
  "delaySeconds": 120, // Opcional (padrão: 120)
  "scheduledAt": "2025-12-25T10:00:00Z" // Opcional
}
```

### Status da Campanha
Os status retornados pelo backend são:
- `PENDING`
- `PROCESSING`
- `PAUSED`
- `COMPLETED`
- `FAILED`

---

## 6. Contatos (`/contacts`)

### Criar Contato (`POST /contacts`)
**Payload:**
```json
{
  "name": "Cliente Exemplo",
  "phone": "5511999999999", // Formato internacional
  "cpf": "12345678900", // Opcional
  "additional1": "Info Extra 1", // Opcional
  "additional2": "Info Extra 2" // Opcional
}
```

---

## Resumo de Mudanças Críticas

1. **Campo `active` vs `isActive`**:
   - O backend usa exclusivamente `isActive` para usuários e instâncias. O frontend deve enviar `isActive`.

2. **QR Code**:
   - Não acesse o painel da Evolution. Use o endpoint `/api/service-instances/:id/qrcode` e exiba a imagem base64 retornada.

3. **Campos Opcionais**:
   - Certifique-se de não enviar `null` para campos opcionais. Envie `undefined` (remova a chave do JSON) ou uma string vazia se o backend aceitar.
