# 📊 Endpoints para Dashboard e Relatórios

Este documento lista todos os endpoints disponíveis para alimentar o Dashboard (`/dashboard`) e a página de Relatórios (`/relatorios`).

---

## 🎯 Dashboard (`/dashboard`)

### 1. Estatísticas Gerais (Cards)

**GET** `/api/dashboard/stats`

**Autenticação**: ✅ Requerida  
**Autorização**: Todos os roles (OPERATOR, SUPERVISOR, ADMIN)

**Descrição**: Retorna as estatísticas para os 4 cards do dashboard.

**Resposta 200 OK**:
```json
{
  "activeConversations": 15,
  "totalMessages": 342,
  "responseRate": 85,
  "averageResponseTime": 120
}
```

**Campos**:
- `activeConversations`: Número de conversas abertas (OPEN)
- `totalMessages`: Total de mensagens enviadas/recebidas hoje
- `responseRate`: Taxa de resposta em porcentagem (0-100)
- `averageResponseTime`: Tempo médio de resposta em segundos

**Nota**: Operadores veem apenas suas próprias estatísticas. Supervisores e Admins veem todas.

---

### 2. Conversas Recentes

**GET** `/api/dashboard/recent-conversations`

**Autenticação**: ✅ Requerida  
**Autorização**: Todos os roles

**Descrição**: Retorna as últimas 5 conversas abertas para exibir no lado esquerdo do dashboard.

**Resposta 200 OK**:
```json
[
  {
    "id": "uuid-1",
    "contactName": "João Silva",
    "contactPhone": "+5511999999999",
    "operatorName": "Maria Santos",
    "lastMessage": "Olá, como posso ajudar?",
    "lastMessageAt": "2025-01-15T14:30:00.000Z",
    "startTime": "2025-01-15T14:00:00.000Z",
    "messageCount": 5
  },
  {
    "id": "uuid-2",
    "contactName": "Pedro Costa",
    "contactPhone": "+5511888888888",
    "operatorName": null,
    "lastMessage": "Preciso de ajuda",
    "lastMessageAt": "2025-01-15T14:25:00.000Z",
    "startTime": "2025-01-15T14:20:00.000Z",
    "messageCount": 3
  }
]
```

**Campos**:
- `id`: ID da conversa
- `contactName`: Nome do contato
- `contactPhone`: Telefone do contato
- `operatorName`: Nome do operador (null se não atribuído)
- `lastMessage`: Última mensagem enviada/recebida
- `lastMessageAt`: Data/hora da última mensagem
- `startTime`: Data/hora de início da conversa
- `messageCount`: Número total de mensagens

**Nota**: Operadores veem apenas suas próprias conversas.

---

### 3. Desempenho Semanal

**GET** `/api/dashboard/weekly-performance`

**Autenticação**: ✅ Requerida  
**Autorização**: Todos os roles

**Descrição**: Retorna dados de desempenho dos últimos 7 dias para gráficos.

**Resposta 200 OK**:
```json
[
  {
    "date": "2025-01-09",
    "responseRate": 80,
    "averageResponseTime": 120,
    "closedConversations": 10
  },
  {
    "date": "2025-01-10",
    "responseRate": 85,
    "averageResponseTime": 115,
    "closedConversations": 12
  },
  {
    "date": "2025-01-11",
    "responseRate": 90,
    "averageResponseTime": 110,
    "closedConversations": 15
  },
  {
    "date": "2025-01-12",
    "responseRate": 88,
    "averageResponseTime": 105,
    "closedConversations": 18
  },
  {
    "date": "2025-01-13",
    "responseRate": 92,
    "averageResponseTime": 100,
    "closedConversations": 20
  },
  {
    "date": "2025-01-14",
    "responseRate": 87,
    "averageResponseTime": 108,
    "closedConversations": 16
  },
  {
    "date": "2025-01-15",
    "responseRate": 85,
    "averageResponseTime": 120,
    "closedConversations": 8
  }
]
```

**Campos**:
- `date`: Data no formato YYYY-MM-DD
- `responseRate`: Taxa de resposta em porcentagem (0-100)
- `averageResponseTime`: Tempo médio de resposta em segundos
- `closedConversations`: Número de conversas fechadas no dia

**Nota**: Sempre retorna 7 dias (últimos 7 dias incluindo hoje).

---

## 📈 Relatórios (`/relatorios`)

### 1. Estatísticas Gerais (com Filtros)

**GET** `/api/reports/statistics`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Data inicial (ISO 8601)
- `endDate` (opcional): Data final (ISO 8601)
- `operatorId` (opcional): Filtrar por operador (UUID)
- `tabulationId` (opcional): Filtrar por tabulação (UUID)
- `serviceInstanceId` (opcional): Filtrar por instância (UUID)

**Resposta 200 OK**:
```json
{
  "totalConversations": 1000,
  "avgDurationSeconds": 1800,
  "avgResponseTimeSeconds": 120,
  "responseRate": 85,
  "tabulationStats": [
    {
      "tabulationId": "uuid-1",
      "tabulationName": "Venda Realizada",
      "count": 450
    },
    {
      "tabulationId": "uuid-2",
      "tabulationName": "Sem Interesse",
      "count": 300
    },
    {
      "tabulationId": "uuid-3",
      "tabulationName": "Conversa Expirada",
      "count": 250
    }
  ]
}
```

**Campos**:
- `totalConversations`: Total de conversas finalizadas no período
- `avgDurationSeconds`: Duração média das conversas em segundos
- `avgResponseTimeSeconds`: Tempo médio de resposta em segundos
- `responseRate`: Taxa de resposta em porcentagem (0-100)
- `tabulationStats`: Estatísticas por tabulação

---

### 2. Performance de Operadores

**GET** `/api/reports/operator-performance`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**: Mesmos do endpoint anterior

**Resposta 200 OK**:
```json
[
  {
    "operatorId": "uuid-1",
    "operatorName": "João Silva",
    "totalConversations": 150,
    "totalMessages": 1250,
    "avgDuration": 1800,
    "avgResponseTime": 120
  },
  {
    "operatorId": "uuid-2",
    "operatorName": "Maria Santos",
    "totalConversations": 200,
    "totalMessages": 1800,
    "avgDuration": 1650,
    "avgResponseTime": 105
  }
]
```

**Campos**:
- `operatorId`: ID do operador
- `operatorName`: Nome do operador
- `totalConversations`: Total de conversas finalizadas
- `totalMessages`: Total de mensagens enviadas pelo operador
- `avgDuration`: Duração média das conversas em segundos
- `avgResponseTime`: Tempo médio de resposta em segundos

---

### 3. Exportar Estatísticas Gerais (CSV)

**GET** `/api/reports/statistics/export`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**: Mesmos do endpoint `/api/reports/statistics`

**Resposta 200 OK**:
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="estatisticas-gerais-2025-01-15.csv"`
- **Body**: Arquivo CSV

---

### 4. Exportar Performance de Operadores (CSV)

**GET** `/api/reports/operator-performance/export`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**: Mesmos do endpoint `/api/reports/operator-performance`

**Resposta 200 OK**:
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="performance-operadores-2025-01-15.csv"`
- **Body**: Arquivo CSV

---

### 5. Exportar Relatório de Campanhas (CSV)

**GET** `/api/reports/campaigns/export`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Filtrar campanhas criadas a partir desta data
- `endDate` (opcional): Filtrar campanhas criadas até esta data
- `serviceInstanceId` (opcional): Filtrar por instância

**Resposta 200 OK**:
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="relatorio-campanhas-2025-01-15.csv"`
- **Body**: Arquivo CSV

**Colunas do CSV**:
- Nome da Campanha
- Instância
- Template
- Supervisor
- Status
- Delay (s)
- Total de Contatos
- Enviadas
- Falhadas
- Pendentes
- Criada em
- Iniciada em
- Finalizada em

---

### 6. Exportar Relatório de Mensagens (CSV)

**GET** `/api/reports/messages/export`

**Autenticação**: ✅ Requerida  
**Autorização**: `ADMIN`, `SUPERVISOR`

**Query Parameters**:
- `startDate` (opcional): Filtrar mensagens a partir desta data
- `endDate` (opcional): Filtrar mensagens até esta data
- `serviceInstanceId` (opcional): Filtrar por instância

**Resposta 200 OK**:
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="relatorio-mensagens-2025-01-15.csv"`
- **Body**: Arquivo CSV

**Colunas do CSV**:
- ID
- Nome do Contato
- Telefone
- Operador
- Instância
- Direção (INBOUND/OUTBOUND)
- Via (INBOUND/CAMPAIGN/CHAT_MANUAL)
- Conteúdo (primeiros 200 caracteres)
- Status
- Tem Mídia (Sim/Não)
- Data/Hora

**Limite**: Máximo de 10.000 mensagens por exportação

---

## 🔗 Endpoints Auxiliares

### Listar Conversas (para "Ver todas as conversas")

**GET** `/api/conversations?status=OPEN&page=1&limit=25`

Veja documentação completa em: [CAMPAIGNS_AND_CONVERSATIONS.md](./CAMPAIGNS_AND_CONVERSATIONS.md)

---

### Listar Campanhas (para "Nova Campanha")

**GET** `/api/campaigns`

Veja documentação completa em: [CAMPAIGNS_AND_CONVERSATIONS.md](./CAMPAIGNS_AND_CONVERSATIONS.md)

---

### Listar Contatos

**GET** `/api/contacts?page=1&limit=25`

---

## 📝 Exemplos de Uso

### Dashboard - Buscar todas as estatísticas

```javascript
// Buscar stats dos cards
const stats = await fetch('/api/dashboard/stats', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Buscar conversas recentes
const recent = await fetch('/api/dashboard/recent-conversations', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Buscar desempenho semanal
const weekly = await fetch('/api/dashboard/weekly-performance', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

### Relatórios - Com filtros de data

```javascript
const startDate = '2025-01-01T00:00:00.000Z';
const endDate = '2025-01-31T23:59:59.999Z';

// Estatísticas gerais
const stats = await fetch(
  `/api/reports/statistics?startDate=${startDate}&endDate=${endDate}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());

// Performance de operadores
const performance = await fetch(
  `/api/reports/operator-performance?startDate=${startDate}&endDate=${endDate}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());
```

### Exportar CSV

```javascript
// Exportar estatísticas
const csv = await fetch(
  `/api/reports/statistics/export?startDate=${startDate}&endDate=${endDate}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.blob());

// Criar link de download
const url = window.URL.createObjectURL(csv);
const a = document.createElement('a');
a.href = url;
a.download = 'estatisticas.csv';
a.click();
```

---

## ⚠️ Observações Importantes

1. **Filtros de Data**: Use formato ISO 8601 (ex: `2025-01-15T00:00:00.000Z`)
2. **Operadores**: Veem apenas seus próprios dados
3. **Supervisores e Admins**: Veem todos os dados
4. **Taxa de Resposta**: Calculada como (conversas com resposta / total) * 100
5. **Tempo Médio**: Sempre em segundos (formate no frontend)
6. **CSV Exports**: Todos retornam arquivos com encoding UTF-8

---

**Última atualização**: Janeiro 2025

