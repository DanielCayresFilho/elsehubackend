# Documentação Completa - Campanhas e Conversas 1x1

## Visão Geral

Este documento descreve todos os endpoints relacionados a **Campanhas** (envio em massa de mensagens) e **Conversas 1x1** (atendimento individual) do sistema Elsehu.

---

## 📢 CAMPANHAS

As campanhas permitem enviar mensagens em massa para uma lista de contatos. O sistema processa os envios de forma assíncrona usando filas (BullMQ), respeitando delays configuráveis entre cada envio.

### Status das Campanhas

- **`PENDING`**: Campanha criada, aguardando upload de contatos e início
- **`PROCESSING`**: Campanha em execução, enviando mensagens
- **`PAUSED`**: Campanha pausada temporariamente (pode ser retomada)
- **`COMPLETED`**: Campanha finalizada com sucesso
- **`FAILED`**: Campanha falhou

### Fluxo de uma Campanha

1. **Criar** a campanha (status: `PENDING`)
2. **Upload** do CSV com contatos
3. **Iniciar** a campanha (status: `PROCESSING`)
4. Sistema processa os envios em fila (com delay configurável)
5. Campanha pode ser **pausada** e **retomada**
6. Ao finalizar, status muda para `COMPLETED` ou `FAILED`

---

## Endpoints de Campanhas

### 1. Criar Campanha

**POST** `/api/campaigns`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Cria uma nova campanha. A campanha é criada com status `PENDING` e precisa ter contatos adicionados via upload de CSV antes de ser iniciada.

**Request Body**:
```json
{
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "uuid-da-instancia",
  "templateId": "uuid-do-template",
  "delaySeconds": 120,
  "scheduledAt": "2025-11-25T10:00:00.000Z"
}
```

**Campos Obrigatórios**:
- `name` (string): Nome descritivo da campanha
- `serviceInstanceId` (string, UUID): ID da instância de serviço que será usada

**Campos Opcionais**:
- `templateId` (string, UUID): ID do template de mensagem (se não informado, será enviada mensagem padrão)
- `delaySeconds` (number, mínimo 30): Delay em segundos entre cada envio (padrão: 120 segundos = 2 minutos)
- `scheduledAt` (string, ISO 8601): Data/hora agendada para início automático (não implementado ainda)

**Validações**:
- A instância de serviço deve existir e estar ativa (`isActive: true`)
- Se `templateId` for fornecido, o template deve existir
- `delaySeconds` deve ser no mínimo 30 segundos

**Response 201 Created**:
```json
{
  "id": "uuid-da-campanha",
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "uuid-do-template",
  "templateName": "Template Black Friday",
  "supervisorId": "uuid-do-supervisor",
  "supervisorName": "João Silva",
  "csvPath": null,
  "status": "PENDING",
  "scheduledAt": null,
  "startedAt": null,
  "finishedAt": null,
  "delaySeconds": 120,
  "totalContacts": 0,
  "sentCount": 0,
  "failedCount": 0,
  "pendingCount": 0
}
```

**Erros Possíveis**:
- `400 Bad Request`: Instância de serviço inativa
- `404 Not Found`: Instância de serviço ou template não encontrado
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 2. Upload de Contatos (CSV)

**POST** `/api/campaigns/:id/upload`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Faz upload de um arquivo CSV com os contatos que receberão as mensagens da campanha. O CSV deve conter uma coluna com números de telefone.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Request**: `multipart/form-data`
- Campo: `file` (arquivo CSV, máximo 10 MB)

**Formato do CSV**:
O CSV deve ter uma coluna com o nome `phone`, `telefone`, `celular` ou `whatsapp`. Exemplo:

```csv
phone
+5511999999999
+5511888888888
+5511777777777
```

Ou com mais colunas:
```csv
name,phone,email
João Silva,+5511999999999,joao@email.com
Maria Santos,+5511888888888,maria@email.com
```

**Validações**:
- A campanha deve existir
- A campanha deve estar com status `PENDING` (não pode adicionar contatos a campanhas já iniciadas)
- O arquivo deve ser CSV válido
- Telefones são normalizados automaticamente (adiciona `+` se necessário)
- Telefones duplicados são removidos automaticamente

**Comportamento**:
1. O arquivo CSV é salvo no storage
2. O CSV é processado linha por linha
3. Para cada telefone:
   - Se o contato já existe (pelo telefone), usa o existente
   - Se não existe, cria um novo contato
4. Cria itens da campanha (`CampaignItem`) vinculando cada contato à campanha
5. Atualiza o campo `csvPath` da campanha com o caminho do arquivo salvo

**Response 200 OK**:
```json
{
  "totalContacts": 150
}
```

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha não está pendente (já foi iniciada)
- `400 Bad Request`: Arquivo inválido ou muito grande (>10 MB)
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 3. Iniciar Campanha

**POST** `/api/campaigns/:id/start`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Inicia o processamento da campanha. A campanha muda para status `PROCESSING` e os jobs são adicionados à fila para envio das mensagens.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Validações**:
- A campanha deve existir
- A campanha deve estar com status `PENDING`
- A campanha deve ter pelo menos 1 contato (itens da campanha)

**Comportamento**:
1. Atualiza o status para `PROCESSING`
2. Define `startedAt` com a data/hora atual
3. Para cada item da campanha (contato), adiciona um job na fila `campaigns` com o tipo `send-message`
4. O worker (`CampaignsProcessor`) processa os jobs respeitando o `delaySeconds` configurado
5. Cada job envia uma mensagem para o contato usando o template (se fornecido)

**Response 200 OK**:
```json
{
  "id": "uuid-da-campanha",
  "name": "Campanha Black Friday 2025",
  "status": "PROCESSING",
  "startedAt": "2025-11-23T19:00:00.000Z",
  "totalContacts": 150,
  "pendingCount": 150,
  "sentCount": 0,
  "failedCount": 0,
  ...
}
```

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha já foi iniciada ou finalizada
- `400 Bad Request`: Campanha não possui contatos (faça upload do CSV primeiro)
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 4. Pausar Campanha

**PATCH** `/api/campaigns/:id/pause`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Pausa temporariamente uma campanha em execução. Os jobs em processamento continuam, mas novos jobs aguardam até a campanha ser retomada.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Validações**:
- A campanha deve existir
- A campanha deve estar com status `PROCESSING`

**Comportamento**:
- Atualiza o status para `PAUSED`
- O worker verifica o status antes de processar cada job
- Se a campanha estiver pausada, o job é movido para "delayed" (aguarda 30 segundos e tenta novamente)

**Response 200 OK**:
```json
{
  "id": "uuid-da-campanha",
  "status": "PAUSED",
  ...
}
```

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha não está em execução
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 5. Retomar Campanha

**PATCH** `/api/campaigns/:id/resume`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Retoma uma campanha que foi pausada. A campanha volta para status `PROCESSING` e os jobs continuam sendo processados.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Validações**:
- A campanha deve existir
- A campanha deve estar com status `PAUSED`

**Response 200 OK**:
```json
{
  "id": "uuid-da-campanha",
  "status": "PROCESSING",
  ...
}
```

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Campanha não está pausada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 6. Listar Todas as Campanhas

**GET** `/api/campaigns`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Retorna todas as campanhas cadastradas, ordenadas por data de criação (mais recentes primeiro).

**Response 200 OK**:
```json
[
  {
    "id": "uuid-1",
    "name": "Campanha Black Friday 2025",
    "serviceInstanceId": "uuid-instancia",
    "serviceInstanceName": "WhatsApp Vendas",
    "templateId": "uuid-template",
    "templateName": "Template Black Friday",
    "supervisorId": "uuid-supervisor",
    "supervisorName": "João Silva",
    "csvPath": "campaigns/campanha-123.csv",
    "status": "PROCESSING",
    "scheduledAt": null,
    "startedAt": "2025-11-23T19:00:00.000Z",
    "finishedAt": null,
    "delaySeconds": 120,
    "totalContacts": 150,
    "sentCount": 45,
    "failedCount": 2,
    "pendingCount": 103
  },
  {
    "id": "uuid-2",
    "name": "Campanha Natal 2025",
    "status": "PENDING",
    "totalContacts": 0,
    ...
  }
]
```

**Campos de Estatísticas**:
- `totalContacts`: Total de contatos na campanha
- `sentCount`: Quantidade de mensagens enviadas com sucesso
- `failedCount`: Quantidade de mensagens que falharam
- `pendingCount`: Quantidade de mensagens ainda pendentes

**Erros Possíveis**:
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 7. Buscar Campanha por ID

**GET** `/api/campaigns/:id`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Retorna os detalhes completos de uma campanha específica.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Response 200 OK**:
```json
{
  "id": "uuid-da-campanha",
  "name": "Campanha Black Friday 2025",
  "serviceInstanceId": "uuid-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "templateId": "uuid-template",
  "templateName": "Template Black Friday",
  "supervisorId": "uuid-supervisor",
  "supervisorName": "João Silva",
  "csvPath": "campaigns/campanha-123.csv",
  "status": "PROCESSING",
  "scheduledAt": null,
  "startedAt": "2025-11-23T19:00:00.000Z",
  "finishedAt": null,
  "delaySeconds": 120,
  "totalContacts": 150,
  "sentCount": 45,
  "failedCount": 2,
  "pendingCount": 103
}
```

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 8. Deletar Campanha

**DELETE** `/api/campaigns/:id`

**Roles**: `ADMIN`, `SUPERVISOR`

**Descrição**: Remove uma campanha do banco de dados. Todos os itens da campanha (`CampaignItem`) também são removidos.

**Parâmetros de URL**:
- `id` (string, UUID): ID da campanha

**Validações**:
- A campanha deve existir
- A campanha **não pode** estar com status `PROCESSING` (em execução)

**Comportamento**:
1. Remove todos os `CampaignItem` associados à campanha
2. Remove a campanha do banco de dados
3. **Nota**: O arquivo CSV salvo no storage não é removido automaticamente

**Response 204 No Content**: Sem corpo de resposta.

**Erros Possíveis**:
- `404 Not Found`: Campanha não encontrada
- `400 Bad Request`: Não é possível remover uma campanha em execução
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

## 💬 CONVERSAS 1x1

As conversas 1x1 são atendimentos individuais entre um contato e um operador. O sistema gerencia a fila de conversas, atribuição de operadores e fechamento com tabulação.

### Status das Conversas

- **`OPEN`**: Conversa aberta (aguardando ou em atendimento)
- **`CLOSED`**: Conversa fechada (finalizada com tabulação)

### Fluxo de uma Conversa

1. **Criar** a conversa (status: `OPEN`, sem operador atribuído)
2. Conversa entra na **fila** de conversas sem operador
3. **Atribuir** um operador à conversa
4. Operador e contato trocam mensagens via `POST /api/messages/send` (veja documentação de Mensagens)
5. **Fechar** a conversa com tabulação (status: `CLOSED`)
6. Conversa é movida para `finished_conversations` (histórico)

**Nota**: Para enviar mensagens, use o endpoint `POST /api/messages/send`. As mensagens são enviadas em tempo real via Evolution API. Veja a documentação completa de Mensagens no `MASTER_DOCUMENTATION.md`.

---

## Endpoints de Conversas

### 1. Criar Conversa

**POST** `/api/conversations`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Cria uma nova conversa 1x1. Se já existir uma conversa aberta para o mesmo contato, retorna a existente ao invés de criar uma nova.

**Request Body**:
```json
{
  "contactId": "uuid-do-contato",
  "serviceInstanceId": "uuid-da-instancia"
}
```

**Campos Obrigatórios**:
- `contactId` (string, UUID): ID do contato
- `serviceInstanceId` (string, UUID): ID da instância de serviço

**Validações**:
- O contato deve existir
- A instância de serviço deve existir e estar ativa (`isActive: true`)

**Comportamento Especial**:
- Se já existir uma conversa aberta (`status: OPEN`) para o mesmo contato, retorna a conversa existente ao invés de criar uma nova
- Isso evita múltiplas conversas abertas para o mesmo contato

**Response 201 Created**:
```json
{
  "id": "uuid-da-conversa",
  "contactId": "uuid-do-contato",
  "contactName": "João Silva",
  "contactPhone": "+5511999999999",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "operatorId": null,
  "operatorName": null,
  "status": "OPEN",
  "startTime": "2025-11-23T19:00:00.000Z",
  "messageCount": 0,
  "lastMessageAt": null
}
```

**Erros Possíveis**:
- `404 Not Found`: Contato ou instância de serviço não encontrado
- `400 Bad Request`: Instância de serviço inativa
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 2. Listar Conversas

**GET** `/api/conversations`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Lista conversas com paginação e filtros. **OPERADORES** só veem suas próprias conversas.

**Query Parameters**:
- `page` (number, opcional, padrão: 1): Número da página
- `limit` (number, opcional, padrão: 25): Itens por página
- `status` (enum, opcional): Filtrar por status (`OPEN` ou `CLOSED`)
- `operatorId` (string, UUID, opcional): Filtrar por operador
- `serviceInstanceId` (string, UUID, opcional): Filtrar por instância de serviço
- `search` (string, opcional): Buscar por nome ou telefone do contato

**Exemplo de Request**:
```
GET /api/conversations?page=1&limit=25&status=OPEN&search=João
```

**Comportamento por Role**:
- **ADMIN** e **SUPERVISOR**: Veem todas as conversas (respeitando os filtros)
- **OPERATOR**: Veem apenas suas próprias conversas (filtro `operatorId` é aplicado automaticamente)

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "uuid-1",
      "contactId": "uuid-contato",
      "contactName": "João Silva",
      "contactPhone": "+5511999999999",
      "serviceInstanceId": "uuid-instancia",
      "serviceInstanceName": "WhatsApp Vendas",
      "operatorId": "uuid-operador",
      "operatorName": "Maria Santos",
      "status": "OPEN",
      "startTime": "2025-11-23T19:00:00.000Z",
      "messageCount": 5,
      "lastMessageAt": "2025-11-23T19:15:00.000Z"
    },
    {
      "id": "uuid-2",
      "status": "CLOSED",
      ...
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

**Erros Possíveis**:
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 3. Buscar Fila de Conversas

**GET** `/api/conversations/queue`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Retorna todas as conversas abertas que ainda não têm operador atribuído (fila de espera). Ordenadas por data de início (mais antigas primeiro).

**Response 200 OK**:
```json
[
  {
    "id": "uuid-1",
    "contactId": "uuid-contato",
    "contactName": "João Silva",
    "contactPhone": "+5511999999999",
    "serviceInstanceId": "uuid-instancia",
    "serviceInstanceName": "WhatsApp Vendas",
    "operatorId": null,
    "operatorName": null,
    "status": "OPEN",
    "startTime": "2025-11-23T19:00:00.000Z",
    "messageCount": 2,
    "lastMessageAt": "2025-11-23T19:05:00.000Z"
  },
  {
    "id": "uuid-2",
    ...
  }
]
```

**Uso**: Este endpoint é útil para mostrar a fila de conversas aguardando atendimento. Supervisores podem usar para distribuir conversas entre operadores.

**Erros Possíveis**:
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 4. Buscar Conversa por ID

**GET** `/api/conversations/:id`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Retorna os detalhes completos de uma conversa específica, incluindo a última mensagem.

**Parâmetros de URL**:
- `id` (string, UUID): ID da conversa

**Response 200 OK**:
```json
{
  "id": "uuid-da-conversa",
  "contactId": "uuid-do-contato",
  "contactName": "João Silva",
  "contactPhone": "+5511999999999",
  "serviceInstanceId": "uuid-da-instancia",
  "serviceInstanceName": "WhatsApp Vendas",
  "operatorId": "uuid-operador",
  "operatorName": "Maria Santos",
  "status": "OPEN",
  "startTime": "2025-11-23T19:00:00.000Z",
  "messageCount": 5,
  "lastMessageAt": "2025-11-23T19:15:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Conversa não encontrada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 5. Atribuir Operador à Conversa

**PATCH** `/api/conversations/:id/assign`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Atribui um operador a uma conversa aberta. Isso remove a conversa da fila e permite que o operador comece a atender.

**Parâmetros de URL**:
- `id` (string, UUID): ID da conversa

**Request Body**:
```json
{
  "operatorId": "uuid-do-operador"
}
```

**Campos Obrigatórios**:
- `operatorId` (string, UUID): ID do operador a ser atribuído

**Validações**:
- A conversa deve existir
- A conversa deve estar com status `OPEN`
- O operador deve existir
- O operador deve estar ativo (`isActive: true`)

**Response 200 OK**:
```json
{
  "id": "uuid-da-conversa",
  "operatorId": "uuid-do-operador",
  "operatorName": "Maria Santos",
  "status": "OPEN",
  ...
}
```

**Erros Possíveis**:
- `404 Not Found`: Conversa ou operador não encontrado
- `400 Bad Request`: Não é possível atribuir operador a uma conversa fechada
- `400 Bad Request`: Operador inativo
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

### 6. Fechar Conversa

**POST** `/api/conversations/:id/close`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Fecha uma conversa e cria um registro em `finished_conversations` com estatísticas e tabulação. A conversa não pode mais receber mensagens.

**Parâmetros de URL**:
- `id` (string, UUID): ID da conversa

**Request Body**:
```json
{
  "tabulationId": "uuid-da-tabulacao"
}
```

**Campos Obrigatórios**:
- `tabulationId` (string, UUID): ID da tabulação (classificação do atendimento)

**Validações**:
- A conversa deve existir
- A conversa não deve estar já fechada
- A tabulação deve existir

**Comportamento**:
1. Calcula a duração da conversa (em segundos)
2. Calcula tempos médios de resposta:
   - `avgResponseTimeUser`: Tempo médio de resposta do usuário (contato)
   - `avgResponseTimeOperator`: Tempo médio de resposta do operador
3. Cria registro em `finished_conversations` com:
   - Dados do contato (nome, telefone)
   - Dados do operador (nome)
   - Timestamps (início, fim, duração)
   - Tempos médios de resposta
   - Tabulação
4. Atualiza o status da conversa para `CLOSED`

**Response 204 No Content**: Sem corpo de resposta.

**Erros Possíveis**:
- `404 Not Found`: Conversa ou tabulação não encontrada
- `400 Bad Request`: Conversa já está fechada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

## Exemplos de Uso

### Exemplo 1: Criar e Iniciar uma Campanha Completa

```bash
# 1. Criar campanha
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Campanha Black Friday",
    "serviceInstanceId": "uuid-instancia",
    "templateId": "uuid-template",
    "delaySeconds": 120
  }'

# 2. Upload CSV
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/{id}/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@contatos.csv"

# 3. Iniciar campanha
curl -X POST https://api.elsehub.covenos.com.br/api/campaigns/{id}/start \
  -H "Authorization: Bearer {token}"
```

### Exemplo 2: Gerenciar Conversa 1x1

```bash
# 1. Criar conversa
curl -X POST https://api.elsehub.covenos.com.br/api/conversations \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "uuid-contato",
    "serviceInstanceId": "uuid-instancia"
  }'

# 2. Buscar fila de conversas
curl -X GET https://api.elsehub.covenos.com.br/api/conversations/queue \
  -H "Authorization: Bearer {token}"

# 3. Atribuir operador
curl -X PATCH https://api.elsehub.covenos.com.br/api/conversations/{id}/assign \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": "uuid-operador"
  }'

# 4. Fechar conversa
curl -X POST https://api.elsehub.covenos.com.br/api/conversations/{id}/close \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tabulationId": "uuid-tabulacao"
  }'
```

### Exemplo 3: Listar Conversas com Filtros

```bash
# Buscar conversas abertas do operador específico
curl -X GET "https://api.elsehub.covenos.com.br/api/conversations?status=OPEN&operatorId=uuid-operador&page=1&limit=25" \
  -H "Authorization: Bearer {token}"

# Buscar conversas por nome/telefone
curl -X GET "https://api.elsehub.covenos.com.br/api/conversations?search=João" \
  -H "Authorization: Bearer {token}"
```

---

## Regras de Negócio Importantes

### Campanhas

1. **Upload de CSV**: Só pode ser feito em campanhas com status `PENDING`
2. **Início**: Só pode iniciar campanhas com pelo menos 1 contato
3. **Pausa/Retomada**: Só funciona em campanhas `PROCESSING` ou `PAUSED`
4. **Deleção**: Não pode deletar campanhas em execução (`PROCESSING`)
5. **Delay**: O delay é respeitado entre cada envio (não é cumulativo)
6. **Processamento**: Os envios são processados de forma assíncrona via fila (BullMQ)

### Conversas

1. **Duplicação**: Não pode haver múltiplas conversas abertas para o mesmo contato
2. **Fila**: Conversas sem operador aparecem na fila (`/queue`)
3. **Atribuição**: Só pode atribuir operador a conversas abertas
4. **Fechamento**: Ao fechar, a conversa é movida para `finished_conversations`
5. **Permissões**: Operadores só veem suas próprias conversas
6. **Tabulação**: Obrigatória ao fechar uma conversa

---

## Tratamento de Erros no Frontend

### Erro 400: Campanha em Execução

```json
{
  "statusCode": 400,
  "message": "Não é possível remover uma campanha em execução"
}
```
**Ação**: Pausar a campanha primeiro, depois deletar.

### Erro 400: Campanha Sem Contatos

```json
{
  "statusCode": 400,
  "message": "Campanha não possui contatos. Faça upload do CSV primeiro."
}
```
**Ação**: Fazer upload do CSV antes de iniciar.

### Erro 400: Conversa Já Fechada

```json
{
  "statusCode": 400,
  "message": "Conversa já está fechada"
}
```
**Ação**: Verificar o status da conversa antes de tentar fechar.

### Erro 400: Não Pode Atribuir Operador

```json
{
  "statusCode": 400,
  "message": "Não é possível atribuir operador a uma conversa fechada"
}
```
**Ação**: Verificar se a conversa está aberta antes de atribuir.

---

## Observações Técnicas

### Processamento de Campanhas

- O sistema usa **BullMQ** para processar os envios de forma assíncrona
- Cada contato gera um job na fila `campaigns`
- O worker (`CampaignsProcessor`) processa os jobs respeitando o delay configurado
- Se a campanha estiver pausada, os jobs aguardam 30 segundos e tentam novamente
- O envio real ainda está em desenvolvimento (TODO no código)

### Estatísticas de Conversas

Ao fechar uma conversa, o sistema calcula:
- **Duração total**: Tempo entre início e fim
- **Tempo médio de resposta do usuário**: Média do tempo entre mensagem do operador e resposta do usuário
- **Tempo médio de resposta do operador**: Média do tempo entre mensagem do usuário e resposta do operador

### Permissões por Role

- **ADMIN**: Acesso total a todas as funcionalidades
- **SUPERVISOR**: Pode criar e gerenciar campanhas, ver todas as conversas, atribuir operadores
- **OPERATOR**: Pode criar conversas, ver apenas suas próprias conversas, fechar conversas que atende

---

## Checklist para Implementação no Frontend

### Campanhas
- [ ] Formulário de criação de campanha
- [ ] Upload de CSV com validação
- [ ] Listagem de campanhas com status e estatísticas
- [ ] Botões de ação (iniciar, pausar, retomar, deletar)
- [ ] Indicador visual de progresso (sentCount/totalContacts)
- [ ] Validação de status antes de ações (ex: não pode deletar em execução)
- [ ] Tratamento de erros específicos

### Conversas
- [ ] Listagem de conversas com paginação e filtros
- [ ] Fila de conversas sem operador
- [ ] Atribuição de operador (dropdown ou seleção)
- [ ] Formulário de fechamento com seleção de tabulação
- [ ] Filtros por status, operador, instância, busca
- [ ] Diferenciação de permissões (operador vs supervisor)
- [ ] Indicador de última mensagem e contagem

