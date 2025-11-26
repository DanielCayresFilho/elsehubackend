# 📢 Como Criar Campanhas - Guia Completo

Este guia explica passo a passo como criar e gerenciar campanhas de envio em massa no sistema Elsehu.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Criando Campanhas com CSV](#criando-campanhas-com-csv)
4. [Criando Campanhas com Contatos Individuais](#criando-campanhas-com-contatos-individuais)
5. [Gerenciando Campanhas](#gerenciando-campanhas)
6. [Exemplos Práticos](#exemplos-práticos)

---

## 🎯 Visão Geral

As campanhas permitem enviar mensagens em massa para múltiplos contatos de forma automatizada. O sistema processa os envios de forma assíncrona, respeitando delays configuráveis entre cada mensagem para evitar bloqueios.

### Status das Campanhas

- **`PENDING`**: Campanha criada, aguardando contatos e início
- **`PROCESSING`**: Campanha em execução, enviando mensagens
- **`PAUSED`**: Campanha pausada temporariamente (pode ser retomada)
- **`COMPLETED`**: Campanha finalizada com sucesso
- **`FAILED`**: Campanha falhou

---

## ✅ Pré-requisitos

Antes de criar uma campanha, você precisa ter:

1. **Instância de Serviço Ativa**: Uma instância WhatsApp (Meta ou Evolution API) configurada e ativa
2. **Template de Mensagem (Opcional)**: Um template criado com a mensagem que será enviada
3. **Permissões**: Usuário com role `ADMIN` ou `SUPERVISOR`
4. **Lista de Contatos**: Arquivo CSV ou lista de contatos para adicionar

---

## 📁 Criando Campanhas com CSV

Esta é a forma mais comum e eficiente para campanhas com muitos contatos.

### Passo 1: Criar a Campanha

**Endpoint**: `POST /api/campaigns`

**Headers**:
```
Authorization: Bearer {seu_token_jwt}
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "uuid-da-instancia-whatsapp",
  "templateId": "uuid-do-template-mensagem",
  "delaySeconds": 120
}
```

**Campos**:
- `name` (obrigatório): Nome descritivo da campanha
- `serviceInstanceId` (obrigatório): ID da instância WhatsApp que será usada
- `templateId` (opcional): ID do template de mensagem
- `delaySeconds` (opcional): Delay em segundos entre envios (padrão: 120 = 2 minutos, mínimo: 30)

**Exemplo com cURL**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campanha Black Friday 2025",
    "serviceInstanceId": "550e8400-e29b-41d4-a716-446655440000",
    "templateId": "660e8400-e29b-41d4-a716-446655440001",
    "delaySeconds": 120
  }'
```

**Resposta**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "660e8400-e29b-41d4-a716-446655440001",
  "templateName": "Template Black Friday",
  "status": "PENDING",
  "delaySeconds": 120,
  "totalContacts": 0,
  "sentCount": 0,
  "failedCount": 0,
  "pendingCount": 0
}
```

**⚠️ Importante**: Anote o `id` da campanha retornado, você precisará dele no próximo passo!

---

### Passo 2: Preparar o Arquivo CSV

O CSV deve conter uma coluna com números de telefone. O sistema reconhece as seguintes colunas:
- `phone`
- `telefone`
- `celular`
- `whatsapp`

**Exemplo 1 - CSV Simples** (`contatos.csv`):
```csv
phone
+5511999999999
+5511888888888
+5511777777777
+5511666666666
```

**Exemplo 2 - CSV com Mais Informações**:
```csv
name,phone,email
João Silva,+5511999999999,joao@email.com
Maria Santos,+5511888888888,maria@email.com
Pedro Costa,+5511777777777,pedro@email.com
```

**⚠️ Observações**:
- O telefone pode estar com ou sem o `+` no início
- O sistema normaliza automaticamente (adiciona `+` se necessário)
- Telefones duplicados são removidos automaticamente
- Apenas a coluna de telefone é obrigatória
- Outras colunas são ignoradas (mas podem ser úteis para referência)

---

### Passo 3: Fazer Upload do CSV

**Endpoint**: `POST /api/campaigns/:id/upload`

**Headers**:
```
Authorization: Bearer {seu_token_jwt}
Content-Type: multipart/form-data
```

**Parâmetros**:
- `id`: ID da campanha criada no Passo 1
- `file`: Arquivo CSV (máximo 10 MB)

**Exemplo com cURL**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002/upload \
  -H "Authorization: Bearer seu_token_aqui" \
  -F "file=@contatos.csv"
```

**Exemplo com JavaScript (fetch)**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch(
  'https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002/upload',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer seu_token_aqui'
    },
    body: formData
  }
);

const result = await response.json();
console.log(result); // { totalContacts: 150 }
```

**Resposta**:
```json
{
  "totalContacts": 150
}
```

**O que acontece internamente**:
1. O arquivo CSV é salvo no storage
2. Cada linha é processada
3. Para cada telefone:
   - Se o contato já existe (pelo telefone), usa o existente
   - Se não existe, cria um novo contato automaticamente
4. Cria itens da campanha vinculando cada contato
5. Remove duplicados automaticamente

---

### Passo 4: Iniciar a Campanha

**Endpoint**: `POST /api/campaigns/:id/start`

**Headers**:
```
Authorization: Bearer {seu_token_jwt}
```

**Exemplo com cURL**:
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002/start \
  -H "Authorization: Bearer seu_token_aqui"
```

**Resposta**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Campanha Black Friday 2025",
  "status": "PROCESSING",
  "startedAt": "2025-11-23T19:00:00.000Z",
  "totalContacts": 150,
  "pendingCount": 150,
  "sentCount": 0,
  "failedCount": 0
}
```

**O que acontece**:
1. Status muda para `PROCESSING`
2. Cada contato é adicionado à fila de envio
3. O worker processa os envios respeitando o `delaySeconds` configurado
4. Mensagens são enviadas uma a uma com o delay entre cada envio

---

## 👤 Criando Campanhas com Contatos Individuais

Atualmente, o sistema não possui um endpoint específico para adicionar contatos individuais a uma campanha. No entanto, você pode seguir estas estratégias:

### Estratégia 1: Criar CSV com Poucos Contatos

Se você tem apenas alguns contatos, pode criar um CSV manualmente:

**Exemplo** (`contatos_pequeno.csv`):
```csv
phone
+5511999999999
+5511888888888
```

Depois, siga os mesmos passos da seção anterior (Upload do CSV).

---

### Estratégia 2: Criar Contatos Primeiro e Depois CSV

1. **Criar os contatos individualmente** via API:
   ```bash
   POST /api/contacts
   {
     "name": "João Silva",
     "phone": "+5511999999999"
   }
   ```

2. **Criar um CSV** com os telefones desses contatos

3. **Fazer upload do CSV** na campanha

**Vantagem**: Os contatos já estarão cadastrados no sistema antes da campanha.

---

### Estratégia 3: Usar CSV Dinâmico (Programaticamente)

Se você tem uma lista de contatos em uma aplicação, pode gerar o CSV programaticamente:

**Exemplo em Python**:
```python
import csv
import requests

# Lista de contatos
contatos = [
    {"name": "João Silva", "phone": "+5511999999999"},
    {"name": "Maria Santos", "phone": "+5511888888888"},
    {"name": "Pedro Costa", "phone": "+5511777777777"},
]

# Criar CSV em memória
import io
csv_buffer = io.StringIO()
writer = csv.DictWriter(csv_buffer, fieldnames=["name", "phone"])
writer.writeheader()
writer.writerows(contatos)

# Fazer upload
files = {'file': ('contatos.csv', csv_buffer.getvalue(), 'text/csv')}
response = requests.post(
    f'https://api.elsehub.covenos.com.br/api/campaigns/{campaign_id}/upload',
    headers={'Authorization': f'Bearer {token}'},
    files=files
)
```

**Exemplo em JavaScript**:
```javascript
const contatos = [
  { name: "João Silva", phone: "+5511999999999" },
  { name: "Maria Santos", phone: "+5511888888888" },
  { name: "Pedro Costa", phone: "+5511777777777" },
];

// Criar CSV
const csv = [
  'name,phone',
  ...contatos.map(c => `${c.name},${c.phone}`)
].join('\n');

// Criar arquivo
const blob = new Blob([csv], { type: 'text/csv' });
const file = new File([blob], 'contatos.csv', { type: 'text/csv' });

// Fazer upload
const formData = new FormData();
formData.append('file', file);

await fetch(
  `https://api.elsehub.covenos.com.br/api/campaigns/${campaignId}/upload`,
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  }
);
```

---

## 🎛️ Gerenciando Campanhas

### Ver Todas as Campanhas

**Endpoint**: `GET /api/campaigns`

**Resposta**:
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Campanha Black Friday 2025",
    "status": "PROCESSING",
    "totalContacts": 150,
    "sentCount": 45,
    "failedCount": 2,
    "pendingCount": 103
  }
]
```

---

### Ver Detalhes de uma Campanha

**Endpoint**: `GET /api/campaigns/:id`

**Resposta**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "660e8400-e29b-41d4-a716-446655440001",
  "templateName": "Template Black Friday",
  "status": "PROCESSING",
  "startedAt": "2025-11-23T19:00:00.000Z",
  "delaySeconds": 120,
  "totalContacts": 150,
  "sentCount": 45,
  "failedCount": 2,
  "pendingCount": 103
}
```

---

### Pausar Campanha

**Endpoint**: `PATCH /api/campaigns/:id/pause`

**Quando usar**: Quando você precisa parar temporariamente o envio (ex: problema detectado, necessidade de ajuste)

**Exemplo**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002/pause \
  -H "Authorization: Bearer seu_token_aqui"
```

**Resposta**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "PAUSED",
  ...
}
```

**⚠️ Importante**: 
- Mensagens já em processamento continuarão sendo enviadas
- Novas mensagens não serão iniciadas
- Você pode retomar depois com `resume`

---

### Retomar Campanha

**Endpoint**: `PATCH /api/campaigns/:id/resume`

**Quando usar**: Para continuar uma campanha que foi pausada

**Exemplo**:
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002/resume \
  -H "Authorization: Bearer seu_token_aqui"
```

**Resposta**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "PROCESSING",
  ...
}
```

---

### Remover Campanha

**Endpoint**: `DELETE /api/campaigns/:id`

**Quando usar**: Para deletar uma campanha que não será mais usada

**⚠️ Restrições**:
- Não é possível remover campanhas com status `PROCESSING`
- Pause a campanha primeiro se necessário

**Exemplo**:
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/campaigns/770e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer seu_token_aqui"
```

**Resposta**: `204 No Content`

---

## 💡 Exemplos Práticos

### Exemplo 1: Campanha Simples com CSV

```bash
# 1. Criar campanha
CAMPAIGN_ID=$(curl -X POST https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Promoção Verão",
    "serviceInstanceId": "550e8400-e29b-41d4-a716-446655440000",
    "delaySeconds": 60
  }' | jq -r '.id')

# 2. Upload CSV
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/$CAMPAIGN_ID/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@contatos.csv"

# 3. Iniciar
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/$CAMPAIGN_ID/start \
  -H "Authorization: Bearer $TOKEN"
```

---

### Exemplo 2: Campanha com Template

```bash
# 1. Criar campanha com template
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Black Friday 2025",
    "serviceInstanceId": "550e8400-e29b-41d4-a716-446655440000",
    "templateId": "660e8400-e29b-41d4-a716-446655440001",
    "delaySeconds": 120
  }'
```

---

### Exemplo 3: Monitorar Progresso

```bash
# Ver status da campanha
while true; do
  curl -s https://api.elsehub.covenos.com.br/api/campaigns/$CAMPAIGN_ID \
    -H "Authorization: Bearer $TOKEN" | jq '{
      status: .status,
      sent: .sentCount,
      failed: .failedCount,
      pending: .pendingCount,
      total: .totalContacts
    }'
  sleep 10
done
```

---

## ⚠️ Boas Práticas

1. **Delay Adequado**: Use pelo menos 60-120 segundos entre envios para evitar bloqueios
2. **Teste com Poucos Contatos**: Antes de enviar para milhares, teste com 5-10 contatos
3. **Verifique Templates**: Certifique-se de que o template está correto antes de iniciar
4. **Monitore o Progresso**: Acompanhe `sentCount`, `failedCount` e `pendingCount`
5. **Pause se Necessário**: Se detectar muitos erros, pause a campanha e investigue
6. **Horários Adequados**: Evite enviar em horários muito tarde da noite
7. **Lista Limpa**: Remova telefones inválidos ou duplicados antes do upload

---

## 🐛 Troubleshooting

### Erro: "Campanha não possui contatos"
**Solução**: Faça upload do CSV antes de iniciar a campanha

### Erro: "Instância de serviço inativa"
**Solução**: Verifique se a instância WhatsApp está ativa no sistema

### Erro: "Campanha já foi iniciada"
**Solução**: Você não pode adicionar contatos ou modificar uma campanha em execução

### Muitos Envios Falhando
**Solução**: 
1. Pause a campanha
2. Verifique se a instância WhatsApp está funcionando
3. Verifique se os telefones estão no formato correto
4. Retome quando resolver

---

## 📚 Referências

- [Documentação Completa de Campanhas](./CAMPAIGNS_AND_CONVERSATIONS.md)
- [API Reference](./API_COMPLETE_REFERENCE.md)
- [Templates de Mensagem](./TEMPLATES.md)

---

**Última atualização**: Novembro 2025

