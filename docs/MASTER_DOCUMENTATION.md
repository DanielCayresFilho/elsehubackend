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

## 5. Lógica de Chat e Distribuição Automática

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

## 6. Contatos (Contacts)

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

## 7. Campanhas (Campaigns)

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

## 8. Templates e Tabulações

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

## 9. Relatórios (Reports)

Endpoints apenas para `ADMIN` e `SUPERVISOR`.

- **GET** `/api/reports/finished-conversations`: Histórico detalhado.
- **GET** `/api/reports/statistics`: Contagem de atendimentos, tempos médios.
- **GET** `/api/reports/operator-performance`: Métricas individuais por operador.
- **Query Params Comuns**:
  ```
  ?startDate=2025-01-01&endDate=2025-01-31&operatorId=...
  ```

---

## 10. Guia de Erros para Frontend

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

