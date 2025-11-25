# Documentação Completa - ElseHub Backend

Esta documentação serve como referência única e absoluta para o funcionamento, endpoints, cargas de dados (JSON) e lógica de negócio da aplicação **ElseHub Backend**.

---

## 1. Visão Geral da Aplicação

O **ElseHub** é um CRM para atendimento via WhatsApp, focado em múltiplos atendentes (operadores), campanhas de disparo em massa e organização de conversas. A aplicação utiliza a **Evolution API** como gateway para conexão com o WhatsApp.

### Principais Funcionalidades
1.  **Gestão de Usuários**: Diferentes níveis de acesso (Admin, Supervisor, Operador).
2.  **Conexão WhatsApp**: Gerenciamento de instâncias e leitura de QR Code via Evolution API.
3.  **Atendimento Humano**: Chat em tempo real via WebSocket.
4.  **Distribuição Automática**: Lógica inteligente para distribuir conversas recebidas entre operadores online.
5.  **Campanhas**: Disparos em massa para listas de contatos.
6.  **Tabulações**: Classificação de conversas finalizadas.
7.  **Relatórios**: Estatísticas de atendimento e performance.

---

## 2. Autenticação e Segurança

O sistema utiliza **JWT (JSON Web Token)**.
- **Access Token**: Validade curta (ex: 15min). Enviado no Header `Authorization: Bearer <token>`.
- **Refresh Token**: Validade longa (ex: 7 dias). Usado para obter novos Access Tokens.

### Endpoints de Auth

#### Login
- **POST** `/api/auth/login`
- **Descrição**: Autentica usuário e retorna tokens.
- **Request JSON**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password123" // Mínimo 6 caracteres
  }
  ```
- **Response JSON**:
  ```json
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid...",
      "name": "Admin",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
  ```

#### Refresh Token
- **POST** `/api/auth/refresh`
- **Request JSON**:
  ```json
  {
    "refreshToken": "eyJhbGci..."
  }
  ```

#### Perfil (Me)
- **GET** `/api/auth/profile`
- **Header**: `Authorization: Bearer <token>`
- **Response**: Dados do usuário logado.

---

## 3. Usuários (Users)

Gerenciamento de quem acessa o sistema.
- **Roles**: `ADMIN` (Tudo), `SUPERVISOR` (Relatórios/Ver), `OPERATOR` (Apenas atendimento).
- **Status**: `isActive` (Bloqueia login se false), `isOnline` (Define disponibilidade para chat).

#### Criar Usuário
- **POST** `/api/users`
- **Roles**: `ADMIN`
- **Request JSON**:
  ```json
  {
    "name": "Nome do Operador",
    "email": "operador@teste.com",
    "password": "senhaForte123", // Mínimo 8 chars
    "role": "OPERATOR", // "ADMIN", "SUPERVISOR", "OPERATOR"
    "isActive": true // Opcional, default true
  }
  ```

#### Listar Usuários
- **GET** `/api/users?page=1&limit=10`
- **Roles**: `ADMIN`, `SUPERVISOR`

#### Atualizar Usuário
- **PATCH** `/api/users/:id`
- **Roles**: `ADMIN`
- **Request JSON** (Todos opcionais):
  ```json
  {
    "name": "Novo Nome",
    "isActive": false // Bloquear usuário
    // "password": "novaSenha"
  }
  ```

#### Deletar Usuário
- **DELETE** `/api/users/:id`
- **Roles**: `ADMIN`
- **Regra**: Não pode deletar a si mesmo.

#### Alternar Status Online (Operador)
- **PATCH** `/api/users/me/toggle-online`
- **Descrição**: O operador avisa ao sistema se está disponível para receber conversas.
- **Request JSON**:
  ```json
  {
    "isOnline": true // ou false
  }
  ```

#### Listar Operadores Online
- **GET** `/api/users/online`
- **Roles**: `ADMIN`, `SUPERVISOR`
- **Retorno**: Lista de usuários com `isOnline: true`.

---

## 4. Instâncias (Service Instances)

Configuração da conexão com a Evolution API.

#### Criar Instância
- **POST** `/api/service-instances`
- **Roles**: `ADMIN`
- **Descrição**: Cria uma instância no banco de dados E na Evolution API (se for provider EVOLUTION_API).
- **Request JSON**:
  ```json
  {
    "name": "Whatsapp Vendas",
    "provider": "EVOLUTION_API",
    "credentials": {
      "serverUrl": "https://evolution.covenos.com.br",
      "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      "instanceName": "vendas01"
    }
  }
  ```
- **Campos das Credenciais (Evolution API)**:
  - `serverUrl`: URL base da Evolution API (sem barra final)
  - `apiToken`: Chave de API (apikey) da Evolution
  - `instanceName`: Nome único da instância (será criada na Evolution)
- **Nota**: O backend automaticamente cria a instância na Evolution API ao salvar. Se a instância já existir na Evolution, o sistema continua normalmente.

#### Listar Instâncias
- **GET** `/api/service-instances`
- **Roles**: `ADMIN`, `SUPERVISOR`
- **Descrição**: Retorna todas as instâncias cadastradas no sistema.
- **Response JSON** (Array):
  ```json
  [
    {
      "id": "uuid...",
      "name": "Whatsapp Vendas",
      "provider": "EVOLUTION_API",
      "credentials": {
        "serverUrl": "https://evolution.covenos.com.br",
        "apiToken": "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
        "instanceName": "vendas01"
      },
      "isActive": true,
      "createdAt": "2025-11-22T10:00:00.000Z",
      "updatedAt": "2025-11-22T10:00:00.000Z"
    }
  ]
  ```

#### Buscar Instância por ID
- **GET** `/api/service-instances/:id`
- **Roles**: `ADMIN`, `SUPERVISOR`
- **Response**: Mesmo formato do item do array acima.

#### Ler QR Code
- **GET** `/api/service-instances/:id/qrcode`
- **Roles**: `ADMIN`, `SUPERVISOR`
- **Descrição**: O backend atua como proxy para buscar o QR Code na Evolution API.
- **Response JSON**:
  ```json
  {
    "qrcode": {
      "pairingCode": "...",
      "code": "data:image/png;base64,..." // Base64 da imagem
    }
  }
  ```
- **Nota**: Se a instância já estiver conectada, a Evolution retorna o status de conexão ao invés do QR Code. O frontend deve tratar isso.

---

## 5. Mensagens (Messages)

Sistema de envio e recebimento de mensagens via WhatsApp, integrado com Evolution API.

### Integração com Evolution API

O sistema envia **e recebe** mensagens reais via Evolution API quando o provedor da instância é `EVOLUTION_API`. O backend:
1. Cria a mensagem no banco com status `pending`
2. Chama a Evolution API: `POST /message/sendText/{instanceName}`
3. Atualiza a mensagem com o `externalId` retornado e o status
4. Nos webhooks, identifica mídias (imagem/áudio/documento) e armazena os metadados

### Mídias Suportadas

- **Imagem (`IMAGE`)**
- **Áudio (`AUDIO`)**
- **Documento (`DOCUMENT`)**

Quando recebidas:
- `hasMedia: true` no payload do chat/WebSocket
- Metadados salvos em `mediaFileName`, `mediaMimeType`, `mediaSize`, `mediaCaption`
- O backend baixa a mídia via `imageMessage.url` **ou** chama automaticamente `POST /chat/getBase64FromMediaMessage/{instance}` (quando a instância Evolution está em modo Base64), decodifica e salva em disco (`storage/messages/<conversationId>/...`) e expõe **duas** URLs:
  - `mediaPublicUrl`: `/media/messages/<conversationId>/<arquivo>` (liberada sem token para renderizar `<img>`, `<audio>`, etc.)
  - `mediaDownloadPath`: normalmente igual a `mediaPublicUrl`; se o arquivo local já tiver expirado, cai para `/api/messages/:id/media` (requer JWT).
- As cópias locais são retidas por **3 dias** (configurável via `MEDIA_RETENTION_DAYS`). Após o purge, os campos acima ficam `null` e o frontend deve mostrar “Mídia expirada”.

Quando recebemos **stickers** ou **vídeos**, criamos uma mensagem automática avisando que ainda não suportamos esse tipo.

### Status das Mensagens

- **`pending`**: Mensagem criada, aguardando envio
- **`sent`**: Mensagem enviada com sucesso
- **`delivered`**: Mensagem entregue ao destinatário
- **`read`**: Mensagem lida pelo destinatário
- **`failed`**: Falha no envio

### Endpoints de Mensagens

#### Enviar Mensagem

**POST** `/api/messages/send`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Envia uma mensagem de texto para um contato através de uma conversa. A mensagem é enviada via Evolution API (ou Meta API) e o status é atualizado automaticamente.

**Request Body**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?",
  "via": "CHAT_MANUAL"
}
```

**Campos Obrigatórios**:
- `conversationId` (string, UUID): ID da conversa
- `content` (string): Conteúdo da mensagem

**Campos Opcionais**:
- `via` (enum): Origem da mensagem
  - `CHAT_MANUAL`: Enviada manualmente pelo operador
  - `CAMPAIGN`: Enviada via campanha
  - `INBOUND`: Mensagem recebida (não usado neste endpoint)

**Validações**:
- A conversa deve existir
- A conversa deve estar com status `OPEN` (não pode enviar para conversa fechada)
- A instância de serviço da conversa deve estar ativa

**Comportamento**:
1. Cria a mensagem no banco com status `pending`
2. Se a instância for `EVOLUTION_API`, chama `POST {serverUrl}/message/sendText/{instanceName}` com:
   ```json
   {
     "number": "5514991484962",
     "text": "Conteúdo da mensagem"
   }
   ```
3. Usa o header `apikey: {apiToken}`
4. Atualiza a mensagem com o `externalId` retornado (geralmente `key.id`) e o status
   - Se a instância for `OFFICIAL_META`, chama `POST https://graph.facebook.com/{version}/{phoneId}/messages` com:
     ```json
     {
       "messaging_product": "whatsapp",
       "to": "5514991484962",
       "type": "text",
       "text": {
         "preview_url": false,
         "body": "Conteúdo da mensagem"
       }
     }
     ```
   - Usa o header `Authorization: Bearer {accessToken}`
   - Atualiza a mensagem com o `message.id` retornado e marca status `sent`
5. Se houver erro, marca como `failed` e retorna erro

**Response 201 Created**:
```json
{
  "id": "uuid-da-mensagem",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-do-operador",
  "senderName": "João Silva",
  "content": "Olá! Como posso ajudar?",
  "hasMedia": false,
  "mediaType": null,
  "mediaFileName": null,
  "mediaMimeType": null,
  "mediaSize": null,
  "mediaDownloadPath": null,
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "externalId": "3EB001A01F2AFFDE364543",
  "status": "sent",
  "createdAt": "2025-11-23T19:55:30.300Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Conversa não encontrada
- `400 Bad Request`: Não é possível enviar mensagem para conversa fechada
- `400 Bad Request`: Instância de serviço inativa
- `400 Bad Request`: Falha ao enviar mensagem na Evolution API (verifique credenciais e conexão)
- `400 Bad Request`: Falha ao enviar mensagem na Meta API (credenciais inválidas, phoneId incorreto, número fora de sessão)
- `401 Unauthorized`: Token de autenticação inválido ou ausente

**Nota**: Se a Evolution API retornar erro (ex: instância desconectada, número inválido), a mensagem será marcada como `failed` e o erro será retornado ao frontend.

---

#### Listar Mensagens de uma Conversa

**GET** `/api/messages/conversation/:conversationId`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Retorna todas as mensagens de uma conversa específica, ordenadas por data de criação (mais antigas primeiro). Inclui paginação.

**Parâmetros de URL**:
- `conversationId` (string, UUID): ID da conversa

**Query Parameters**:
- `page` (number, opcional, padrão: 1): Número da página
- `limit` (number, opcional, padrão: 50): Itens por página

**Exemplo de Request**:
```
GET /api/messages/conversation/uuid-da-conversa?page=1&limit=50
```

**Response 200 OK**:
```json
{
  "data": [
    {
      "id": "uuid-1",
      "conversationId": "uuid-da-conversa",
      "senderId": null,
      "senderName": null,
      "content": "Olá, preciso de ajuda",
      "hasMedia": false,
      "mediaType": null,
      "mediaDownloadPath": null,
      "direction": "INBOUND",
      "via": "INBOUND",
      "externalId": "evol_123",
      "status": "received",
      "createdAt": "2025-11-23T19:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "conversationId": "uuid-da-conversa",
      "senderId": "uuid-operador",
      "senderName": "João Silva",
      "content": "Olá! Como posso ajudar?",
      "hasMedia": false,
      "mediaType": null,
      "mediaDownloadPath": null,
      "direction": "OUTBOUND",
      "via": "CHAT_MANUAL",
      "externalId": "3EB001A01F2AFFDE364543",
      "status": "sent",
      "createdAt": "2025-11-23T19:05:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Campos da Mensagem**:
- `direction`: `INBOUND` (recebida) ou `OUTBOUND` (enviada)
- `via`: `INBOUND`, `CHAT_MANUAL`, ou `CAMPAIGN`
- `externalId`: ID da mensagem na Evolution API (se enviada via API)
- `status`: Status atual da mensagem (sent, delivered, read, failed, etc.)

**Erros Possíveis**:
- `404 Not Found`: Conversa não encontrada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

---

#### Buscar Mensagem por ID

**GET** `/api/messages/:id`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Retorna os detalhes de uma mensagem específica.

**Parâmetros de URL**:
- `id` (string, UUID): ID da mensagem

**Response 200 OK**:
```json
{
  "id": "uuid-da-mensagem",
  "conversationId": "uuid-da-conversa",
  "senderId": "uuid-operador",
  "senderName": "João Silva",
  "content": "Olá! Como posso ajudar?",
  "hasMedia": false,
  "mediaType": null,
  "mediaDownloadPath": null,
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "externalId": "3EB001A01F2AFFDE364543",
  "status": "sent",
  "createdAt": "2025-11-23T19:05:00.000Z"
}
```

**Erros Possíveis**:
- `404 Not Found`: Mensagem não encontrada
- `401 Unauthorized`: Token de autenticação inválido ou ausente

#### Baixar Mídia de uma Mensagem

**GET** `/api/messages/:id/media`

**Roles**: `ADMIN`, `SUPERVISOR`, `OPERATOR`

**Descrição**: Faz proxy seguro do arquivo armazenado na Evolution API.

**Comportamento**:
- Busca a mensagem no banco
- Recupera a URL interna e credenciais da instância
- Faz download via Evolution usando `apikey`
- Faz stream do arquivo para o cliente

**Erros Possíveis**:
- `404 Not Found`: Mensagem não existe ou não possui mídia
- `400 Bad Request`: Provedor ainda não suportado (Meta)
- `401 Unauthorized`: Token inválido

---

### WebSocket - Envio de Mensagens

O sistema também suporta envio de mensagens via WebSocket para atualização em tempo real.

**Evento**: `message:send`

**Payload**:
```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Olá! Como posso ajudar?"
}
```

**Resposta**:
```json
{
  "success": true,
  "message": {
    "id": "uuid-da-mensagem",
    "content": "Olá! Como posso ajudar?",
    "status": "sent",
    ...
  }
}
```

O servidor também emite o evento `message:new` para todos os clientes conectados à sala da conversa, permitindo atualização em tempo real.

---

### Exemplos de Uso

#### Exemplo 1: Enviar Mensagem via API

```bash
curl -X POST https://api.elsehub.covenos.com.br/api/messages/send \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "uuid-da-conversa",
    "content": "Olá! Como posso ajudar?"
  }'
```

#### Exemplo 2: Listar Mensagens de uma Conversa

```bash
curl -X GET "https://api.elsehub.covenos.com.br/api/messages/conversation/uuid-da-conversa?page=1&limit=50" \
  -H "Authorization: Bearer {token}"
```

#### Exemplo 3: Buscar Mensagem Específica

```bash
curl -X GET https://api.elsehub.covenos.com.br/api/messages/uuid-da-mensagem \
  -H "Authorization: Bearer {token}"
```

---

### Observações Importantes

1. **Integração Evolution API**: O envio de mensagens é feito em tempo real via Evolution API. Se a instância estiver desconectada ou houver erro, a mensagem será marcada como `failed`.

2. **Status das Mensagens**: O status inicial é `pending`. Após o envio bem-sucedido, muda para `sent`. A Evolution API pode atualizar o status para `delivered` ou `read` via webhooks.

3. **Conversas Fechadas**: Não é possível enviar mensagens para conversas com status `CLOSED`. A conversa deve estar `OPEN`.

4. **Telefone**: O número de telefone é normalizado automaticamente (remove caracteres especiais, adiciona `+` se necessário) antes de enviar para a Evolution API.

5. **Erros de Envio**: Se houver erro na Evolution API (ex: instância desconectada, número inválido, rate limit), a mensagem será marcada como `failed` e o erro será retornado ao frontend.

6. **Webhooks**: O sistema recebe atualizações de status (delivered, read) via webhooks da Evolution API. Esses status são atualizados automaticamente no banco de dados.

---

## 6. Lógica de Chat e Distribuição Automática

O coração do sistema de atendimento.

### Regras de Negócio
1.  **Status Online**: Apenas operadores com `isOnline: true` recebem novas conversas.
2.  **Fila/Distribuição**: Quando uma mensagem chega de um contato *sem conversa ativa*:
    *   O sistema busca operadores online.
    *   Ordena por quem está há mais tempo sem receber uma *nova* conversa (`lastConversationAssignedAt`).
    *   Atribui a conversa e notifica via WebSocket.
3.  **Isolamento**: Operadores só veem as conversas atribuídas a eles. Admins veem tudo.
4.  **Expiração (24h)**: Uma tarefa agendada (Cron) roda a cada hora. Conversas sem interação há mais de 24h são fechadas automaticamente e tabuladas como "Conversa Expirada".
5.  **Reabertura**: Se um cliente responde após a expiração, uma *nova* conversa é criada e distribuída novamente.

### Endpoints de Conversas

#### Criar Conversa (Manual)
- **POST** `/api/conversations`
- **Request JSON**:
  ```json
  {
    "contactId": "uuid-do-contato",
    "serviceInstanceId": "uuid-da-instancia"
  }
  ```

#### Listar Conversas
- **GET** `/api/conversations`
- **Filtros**: Por padrão, operadores veem apenas as suas.

#### Atribuir Operador (Transferência)
- **PATCH** `/api/conversations/:id/assign`
- **Request JSON**:
  ```json
  {
    "operatorId": "uuid-do-novo-operador"
  }
  ```

#### Finalizar Conversa (Tabular)
- **POST** `/api/conversations/:id/close`
- **Request JSON**:
  ```json
  {
    "tabulationId": "uuid-da-tabulacao"
  }
  ```
- **Efeito**: Move a conversa para "Conversas Finalizadas" (histórico) e libera o operador.

#### WebSocket
- **URL**: `wss://api.seudominio.com` (ou `ws://localhost:3000`)
- **Eventos**:
  - `client->server`: `joinRoom` (entrar na sala da conversa), `sendMessage` (enviar texto).
  - `server->client`: `newMessage` (nova mensagem recebida/enviada), `conversationAssigned` (quando uma nova conversa cai para o operador).

---

## 7. Contatos (Contacts)

#### Criar Contato
- **POST** `/api/contacts`
- **Request JSON**:
  ```json
  {
    "name": "João Silva",
    "phone": "5511999999999", // Formato E.164 (sem + é aceito, mas ideal com código país)
    "cpf": "12345678900",     // Opcional
    "additional1": "Info Extra", // Opcional
    "additional2": "Outra Info"  // Opcional
  }
  ```

#### Importar CSV
- **POST** `/api/contacts/import/csv`
- **Body**: `FormData` com campo `file`.
- **Formato CSV**: `name,phone,cpf,additional1` (cabeçalho obrigatório).

#### Deletar Contato
- **DELETE** `/api/contacts/:id`
- **Erro 400**: Se o contato tiver conversas ou históricos, o sistema bloqueia e retorna mensagem amigável.

---

## 8. Campanhas (Campaigns)

Sistema de disparo em massa.

#### Criar Campanha
- **POST** `/api/campaigns`
- **Request JSON**:
  ```json
  {
    "name": "Promoção Black Friday",
    "serviceInstanceId": "uuid-instancia",
    "templateId": "uuid-template",     // Opcional
    "delaySeconds": 120,               // Delay entre mensagens (min 30s)
    "scheduledAt": "2025-12-25T10:00:00Z" // Opcional (Agendamento)
  }
  ```

#### Fluxo de Campanha
1.  **Upload de Contatos**: `POST /api/campaigns/:id/upload` (Arquivo CSV/Excel).
2.  **Iniciar**: `POST /api/campaigns/:id/start`. O status muda para `PROCESSING`.
3.  **Pausar/Retomar**: `PATCH .../pause`, `PATCH .../resume`.

---

## 9. Templates e Tabulações

#### Templates (Mensagens Prontas)
- **POST** `/api/templates`
- **Request JSON**:
  ```json
  {
    "name": "Boas Vindas",
    "body": "Olá {{name}}, tudo bem?", // Variáveis simples
    "serviceInstanceId": "uuid-instancia"
  }
  ```

#### Tabulações (Motivos de Fechamento)
- **POST** `/api/tabulations`
- **Request JSON**:
  ```json
  {
    "name": "Venda Concluída"
  }
  ```
- **Sistema**: Cria automaticamente uma tabulação "Conversa Expirada" se não existir.

---

## 10. Relatórios (Reports)

Endpoints apenas para `ADMIN` e `SUPERVISOR`.

- **GET** `/api/reports/finished-conversations`: Histórico detalhado.
- **GET** `/api/reports/statistics`: Contagem de atendimentos, tempos médios.
- **GET** `/api/reports/operator-performance`: Métricas individuais por operador.
- **Query Params Comuns**:
  ```
  ?startDate=2025-01-01&endDate=2025-01-31&operatorId=...
  ```

---

## 11. Guia de Erros para Frontend

O backend retorna erros padronizados. O Frontend deve observar o campo `message`:

1.  **Erro 400 (Bad Request)**:
    *   Se `message` for **Array**: Erro de validação de formulário (ex: email inválido).
    *   Se `message` for **String**: Regra de negócio (ex: "Não é possível deletar contato com conversas").
2.  **Erro 401 (Unauthorized)**: Token expirado ou credenciais inválidas. Redirecionar para Login.
3.  **Erro 403 (Forbidden)**: Usuário sem permissão (Role insuficiente).
4.  **Erro 404 (Not Found)**: Recurso não encontrado.

**Exemplo de Erro de Negócio:**
```json
{
  "statusCode": 400,
  "message": "Não é possível remover este contato pois ele possui conversas associadas",
  "path": "/api/contacts/123"
}
```

