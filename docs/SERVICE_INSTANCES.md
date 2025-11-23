# Documentação Completa - Instâncias de Serviço (Service Instances)

## Visão Geral

As **Service Instances** são configurações que conectam o sistema Elsehu com provedores de WhatsApp, como a Evolution API ou a API oficial da Meta. Cada instância representa uma conexão única com um número de WhatsApp.

## Tipos de Provedores

O sistema suporta dois tipos de provedores:

1. **`EVOLUTION_API`**: Integração com Evolution API (Baileys)
2. **`OFFICIAL_META`**: Integração com a API oficial da Meta (WhatsApp Business API)

---

## Endpoints

### 1. Criar Instância

**POST** `/api/service-instances`

**Roles**: `ADMIN`

**Descrição**: Cria uma nova instância de serviço no banco de dados. Se o provedor for `EVOLUTION_API`, o sistema também cria a instância automaticamente na Evolution API.

**Request Body**:
```json
{
  "name": "WhatsApp Vendas",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  }
}
```

**Campos Obrigatórios**:
- `name` (string): Nome descritivo da instância (ex: "WhatsApp Vendas", "Atendimento Principal")
- `provider` (enum): `EVOLUTION_API` ou `OFFICIAL_META`
- `credentials` (object): Objeto com as credenciais específicas do provedor

**Credenciais para Evolution API**:
```json
{
  "serverUrl": "https://evolution.covenos.com.br",  // URL base da Evolution (sem barra final)
  "apiToken": "sua-api-key-aqui",                   // Chave de API da Evolution
  "instanceName": "nome-unico-instancia"            // Nome único da instância (será criada na Evolution)
}
```

**Credenciais para Meta (Official)**:
```json
{
  "wabaId": "123456789",           // WhatsApp Business Account ID
  "phoneId": "987654321",          // Phone Number ID
  "accessToken": "token-aqui"      // Access Token da Meta
}
```

**Response 201 Created**:
```json
{
  "id": "uuid-da-instancia",
  "name": "WhatsApp Vendas",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  },
  "isActive": true,
  "createdAt": "2025-11-23T18:00:00.000Z",
  "updatedAt": "2025-11-23T18:00:00.000Z"
}
```

**Comportamento Especial (Evolution API)**:
- Quando você cria uma instância com `provider: "EVOLUTION_API"`, o backend automaticamente:
  1. Faz uma chamada POST para `{serverUrl}/instance/create` na Evolution API
  2. Envia o body: `{ "instanceName": "...", "integration": "WHATSAPP-BAILEYS", "qrcode": true }`
  3. Usa o header `apikey: {apiToken}`
  4. **Configura o webhook automaticamente** para receber mensagens:
     - URL: `{APP_URL}/api/webhooks/evolution`
     - Eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`
  5. Se a instância já existir na Evolution, o sistema continua normalmente (não é erro)
  6. Se houver erro de autenticação (401), retorna erro
  7. Se houver outro erro, retorna erro com detalhes

**⚠️ IMPORTANTE - Variável de Ambiente para Webhook**:
Para que o webhook seja configurado automaticamente, você precisa definir uma dessas variáveis de ambiente:
```bash
APP_URL=https://api.elsehub.com
# OU
WEBHOOK_URL=https://api.elsehub.com/api/webhooks/evolution
```

Se não configurar, o webhook não será configurado automaticamente e você precisará configurar manualmente na Evolution API.

**Erros Possíveis**:
- `400 Bad Request`: Credenciais incompletas ou inválidas
- `401 Unauthorized`: Token de autenticação inválido ou ausente
- `400 Bad Request`: Falha ao criar na Evolution API (verifique URL, token e se a instância já existe)

---

### 2. Listar Todas as Instâncias

**GET** `/api/service-instances`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Retorna todas as instâncias cadastradas no sistema, ordenadas por data de criação (mais recentes primeiro).

**Response 200 OK**:
```json
[
  {
    "id": "uuid-1",
    "name": "WhatsApp Vendas",
    "provider": "EVOLUTION_API",
    "credentials": {
      "serverUrl": "https://evolution.covenos.com.br",
      "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      "instanceName": "vendas01"
    },
    "isActive": true,
    "createdAt": "2025-11-23T18:00:00.000Z",
    "updatedAt": "2025-11-23T18:00:00.000Z"
  },
  {
    "id": "uuid-2",
    "name": "Atendimento Principal",
    "provider": "OFFICIAL_META",
    "credentials": {
      "wabaId": "123456789",
      "phoneId": "987654321",
      "accessToken": "token-aqui"
    },
    "isActive": true,
    "createdAt": "2025-11-22T10:00:00.000Z",
    "updatedAt": "2025-11-22T10:00:00.000Z"
  }
]
```

**Erros Possíveis**:
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 3. Buscar Instância por ID

**GET** `/api/service-instances/:id`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Retorna os detalhes de uma instância específica.

**Parâmetros de URL**:
- `id` (string, UUID): ID da instância

**Response 200 OK**:
```json
{
  "id": "uuid-da-instancia",
  "name": "WhatsApp Vendas",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "vendas01"
  },
  "isActive": true,
  "createdAt": "2025-11-23T18:00:00.000Z",
  "updatedAt": "2025-11-23T18:00:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Instância não encontrada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 4. Obter QR Code da Instância

**GET** `/api/service-instances/:id/qrcode`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Obtém o QR Code ou código de pareamento da instância Evolution API. O backend atua como proxy, fazendo uma requisição para a Evolution API e retornando o QR Code.

**Parâmetros de URL**:
- `id` (string, UUID): ID da instância

**Comportamento**:
1. O backend busca a instância no banco de dados
2. Verifica se o provedor é `EVOLUTION_API` (único que suporta QR Code)
3. Faz uma requisição GET para `{serverUrl}/instance/connect/{instanceName}` na Evolution API
4. Usa o header `apikey: {apiToken}`
5. Retorna o QR Code ou código de pareamento

**Response 200 OK** (QR Code disponível):
```json
{
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**Response 200 OK** (Código de pareamento):
```json
{
  "pairingCode": "12345678"
}
```

**Response 200 OK** (Já conectada):
```json
{
  "message": "Instância já conectada"
}
```

**Erros Possíveis**:
- `404 Not Found`: Instância não encontrada
- `400 Bad Request`: QR Code disponível apenas para Evolution API
- `400 Bad Request`: Credenciais inválidas para conectar
- `400 Bad Request`: Falha ao comunicar com a Evolution API
- `401 Unauthorized`: Token de autenticação inválido ou ausente

**Nota**: Se a instância já estiver conectada ao WhatsApp, a Evolution API retorna o status de conexão ao invés do QR Code. O frontend deve tratar isso adequadamente.

---

### 5. Atualizar Instância

**PATCH** `/api/service-instances/:id`

**Roles**: `ADMIN`

**Descrição**: Atualiza parcialmente uma instância existente. Todos os campos são opcionais.

**Parâmetros de URL**:
- `id` (string, UUID): ID da instância

**Request Body** (todos os campos são opcionais):
```json
{
  "name": "Novo Nome",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "novo-token",
    "instanceName": "novo-nome-instancia"
  },
  "isActive": false
}
```

**Validação**:
- Se `provider` e `credentials` forem fornecidos juntos, ambos são validados
- Se apenas `credentials` for fornecido, usa o `provider` atual da instância para validar
- As credenciais são validadas de acordo com o provedor (Evolution API ou Meta)

**Response 200 OK**:
```json
{
  "id": "uuid-da-instancia",
  "name": "Novo Nome",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "novo-token",
    "instanceName": "novo-nome-instancia"
  },
  "isActive": false,
  "createdAt": "2025-11-23T18:00:00.000Z",
  "updatedAt": "2025-11-23T19:00:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Instância não encontrada
- `400 Bad Request`: Credenciais incompletas ou inválidas
- `401 Unauthorized`: Token de autenticação inválido ou ausente

**Nota**: A atualização **não** cria ou atualiza a instância na Evolution API. Se você mudar o `instanceName` ou outras credenciais, você precisa gerenciar isso manualmente na Evolution API.

---

### 6. Deletar Instância

**DELETE** `/api/service-instances/:id`

**Roles**: `ADMIN`

**Descrição**: Remove uma instância do banco de dados. A instância só pode ser removida se não tiver conversas ou campanhas associadas.

**Parâmetros de URL**:
- `id` (string, UUID): ID da instância

**Response 204 No Content**: Sem corpo de resposta.

**Erros Possíveis**:
- `404 Not Found`: Instância não encontrada
- `400 Bad Request`: Não é possível remover uma instância com conversas ou campanhas associadas
- `401 Unauthorized`: Token de autenticação inválido ou ausente

**Nota**: A deleção **não** remove a instância da Evolution API. Se você quiser remover também da Evolution, precisa fazer isso manualmente através da API da Evolution ou do manager.

---

## Fluxo Completo: Criar e Conectar uma Instância Evolution API

### Passo 1: Criar a Instância
```bash
POST /api/service-instances
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Minha Instância",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
    "instanceName": "minha-instancia-01"
  }
}
```

**O que acontece**:
1. Backend valida as credenciais
2. Backend faz POST para `https://evolution.covenos.com.br/instance/create` com:
   ```json
   {
     "instanceName": "minha-instancia-01",
     "integration": "WHATSAPP-BAILEYS",
     "qrcode": true
   }
   ```
3. Backend salva a instância no banco de dados
4. Retorna a instância criada

### Passo 2: Obter o QR Code
```bash
GET /api/service-instances/{id}/qrcode
Authorization: Bearer {token}
```

**O que acontece**:
1. Backend busca a instância no banco
2. Backend faz GET para `https://evolution.covenos.com.br/instance/connect/minha-instancia-01`
3. Evolution retorna o QR Code ou código de pareamento
4. Backend retorna para o frontend

### Passo 3: Escanear o QR Code
- O usuário escaneia o QR Code com o WhatsApp
- A instância fica conectada na Evolution API

### Passo 4: Verificar Status (Opcional)
- Você pode chamar novamente o endpoint `/qrcode` para verificar se está conectada
- Se estiver conectada, retorna `{ "message": "Instância já conectada" }`

---

## Validações e Regras de Negócio

### Validação de Credenciais

**Evolution API**:
- `serverUrl`: Obrigatório, deve ser uma URL válida (sem barra final)
- `apiToken`: Obrigatório, string não vazia
- `instanceName`: Obrigatório, string não vazia (nome único na Evolution)

**Meta (Official)**:
- `wabaId`: Obrigatório, string não vazia
- `phoneId`: Obrigatório, string não vazia
- `accessToken`: Obrigatório, string não vazia

### Regras de Deleção

Uma instância **não pode ser deletada** se:
- Tiver conversas associadas (`conversations.length > 0`)
- Tiver campanhas associadas (`campanhas.length > 0`)

Nesses casos, o sistema retorna erro `400 Bad Request` com a mensagem: "Não é possível remover uma instância com conversas ou campanhas associadas".

### Integração com Evolution API

**Criação Automática**:
- Ao criar uma instância `EVOLUTION_API`, o backend automaticamente cria na Evolution
- Se a instância já existir na Evolution, o sistema continua normalmente (não é erro)
- Se houver erro de autenticação (401), o backend retorna erro
- Outros erros também são retornados ao frontend

**QR Code**:
- O endpoint `/qrcode` funciona apenas para instâncias `EVOLUTION_API`
- O backend faz proxy para a Evolution API
- Retorna QR Code base64, código de pareamento ou mensagem de "já conectada"

**Atualização e Deleção**:
- Atualizar ou deletar uma instância no Elsehu **não** afeta a instância na Evolution API
- Você precisa gerenciar a Evolution API separadamente se necessário

---

## Exemplos de Uso

### Exemplo 1: Criar Instância Evolution API
```bash
curl -X POST https://api.elsehub.covenos.com.br/api/service-instances \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Vendas",
    "provider": "EVOLUTION_API",
    "credentials": {
      "serverUrl": "https://evolution.covenos.com.br",
      "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      "instanceName": "vendas01"
    }
  }'
```

### Exemplo 2: Listar Todas as Instâncias
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/service-instances \
  -H "Authorization: Bearer {token}"
```

### Exemplo 3: Obter QR Code
```bash
curl -X GET https://api.elsehub.covenos.com.br/api/service-instances/{id}/qrcode \
  -H "Authorization: Bearer {token}"
```

### Exemplo 4: Atualizar Instância
```bash
curl -X PATCH https://api.elsehub.covenos.com.br/api/service-instances/{id} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Nome",
    "isActive": false
  }'
```

### Exemplo 5: Deletar Instância
```bash
curl -X DELETE https://api.elsehub.covenos.com.br/api/service-instances/{id} \
  -H "Authorization: Bearer {token}"
```

---

## Tratamento de Erros no Frontend

### Erro 400: Credenciais Inválidas
```json
{
  "statusCode": 400,
  "message": "Credenciais da Evolution API incompletas. Necessário: instanceName, apiToken, serverUrl"
}
```
**Ação**: Verificar se todos os campos obrigatórios foram enviados.

### Erro 400: Falha ao Criar na Evolution
```json
{
  "statusCode": 400,
  "message": "Falha ao criar instância na Evolution API: {detalhes do erro}"
}
```
**Ação**: Verificar se a URL da Evolution está correta, se o token é válido, e se a instância já existe.

### Erro 400: Instância com Dependências
```json
{
  "statusCode": 400,
  "message": "Não é possível remover uma instância com conversas ou campanhas associadas"
}
```
**Ação**: Remover primeiro as conversas e campanhas associadas, ou desativar a instância ao invés de deletar.

### Erro 404: Instância Não Encontrada
```json
{
  "statusCode": 404,
  "message": "Instância não encontrada"
}
```
**Ação**: Verificar se o ID da instância está correto.

### Erro 401: Não Autorizado
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Ação**: Verificar se o token de autenticação está presente e válido. Fazer login novamente se necessário.

---

## Status da Instância

Cada instância possui um campo `isActive` (boolean) que indica se ela está ativa ou não:
- `true`: Instância está ativa e pode ser usada
- `false`: Instância está desativada (não será usada em novas conversas/campanhas)

Você pode atualizar esse campo usando o endpoint PATCH.

---

## Configuração Automática de Webhook

### Evolution API

Quando você cria uma instância Evolution API, o sistema **automaticamente configura o webhook** para receber mensagens em tempo real.

**O que é configurado**:
- **URL do Webhook**: `{APP_URL}/api/webhooks/evolution`
- **Eventos**:
  - `MESSAGES_UPSERT`: Mensagens recebidas/enviadas
  - `MESSAGES_UPDATE`: Atualização de status (sent, delivered, read)
  - `CONNECTION_UPDATE`: Atualização de conexão da instância

**Variável de Ambiente Necessária**:
```bash
# Defina uma dessas variáveis no seu .env ou ambiente de produção:
APP_URL=https://api.elsehub.com
# OU
WEBHOOK_URL=https://api.elsehub.com/api/webhooks/evolution
```

**Se não configurar a variável**:
- O webhook não será configurado automaticamente
- Você precisará configurar manualmente na Evolution API
- As mensagens recebidas não aparecerão automaticamente no sistema

**Como verificar se está configurado**:
1. Verifique os logs do backend ao criar a instância
2. Deve aparecer: `Webhook configurado com sucesso para instância: {nome}`
3. Se aparecer aviso, o webhook não foi configurado

**Configuração Manual (se necessário)**:
Se o webhook não foi configurado automaticamente, você pode configurar manualmente:

1. **Via Manager da Evolution API**:
   - Acesse o Manager da sua Evolution API
   - Vá em "Webhooks" ou "Configurações"
   - Configure a URL: `https://api.elsehub.com/api/webhooks/evolution`
   - Selecione os eventos: `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`

2. **Via API da Evolution**:
   ```bash
   curl -X POST https://evolution.covenos.com.br/webhook/set/{instanceName} \
     -H "apikey: {apiToken}" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://api.elsehub.com/api/webhooks/evolution",
       "webhook_by_events": true,
       "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
     }'
   ```

---

## Observações Importantes

1. **Segurança**: As credenciais são armazenadas no banco de dados como JSON. Certifique-se de que o banco está seguro.

2. **Evolution API**: O backend faz chamadas diretas para a Evolution API. Certifique-se de que o servidor da Evolution está acessível e que o token está correto.

3. **Instance Name**: O `instanceName` deve ser único na Evolution API. Se você tentar criar uma instância com um nome que já existe, o sistema continua normalmente (não é erro).

4. **QR Code**: O QR Code expira após alguns minutos. Se o usuário não escanear a tempo, você precisa chamar o endpoint `/qrcode` novamente para obter um novo QR Code.

5. **Webhook**: O webhook é configurado automaticamente ao criar a instância (se `APP_URL` ou `WEBHOOK_URL` estiver configurado). Sem webhook, mensagens recebidas não aparecerão no sistema.

6. **Deleção**: Deletar uma instância no Elsehu não remove ela da Evolution API. Se você quiser remover também da Evolution, faça isso manualmente.

7. **Atualização**: Atualizar credenciais no Elsehu não atualiza na Evolution API. Se você mudar o `instanceName`, você precisa gerenciar isso na Evolution separadamente.

---

## Checklist para Implementação no Frontend

- [ ] Criar formulário de criação de instância com validação de campos
- [ ] Implementar listagem de instâncias com paginação (se necessário)
- [ ] Implementar visualização de QR Code (imagem base64 ou código de pareamento)
- [ ] Implementar atualização de instância (nome, status ativo/inativo)
- [ ] Implementar deleção com confirmação e tratamento de erros
- [ ] Tratar erros específicos (instância com dependências, credenciais inválidas, etc.)
- [ ] Mostrar status de conexão (conectada, desconectada, conectando)
- [ ] Implementar refresh do QR Code quando expirar
- [ ] Validar credenciais antes de enviar (Evolution API vs Meta)

