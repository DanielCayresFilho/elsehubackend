# Documentação Completa - Envio de Mensagens com Instâncias Evolution API

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Funciona o Sistema de Instâncias](#como-funciona-o-sistema-de-instâncias)
3. [Fluxo Completo de Envio](#fluxo-completo-de-envio)
4. [Exemplos Práticos por Instância](#exemplos-práticos-por-instância)
5. [Implementação no Frontend](#implementação-no-frontend)
6. [Tratamento de Erros](#tratamento-de-erros)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O sistema Elsehu permite enviar mensagens via WhatsApp usando múltiplas instâncias da Evolution API. Cada instância representa uma conexão única com um número de WhatsApp diferente.

**Conceitos Importantes:**
- **Instância**: Uma conexão com um número de WhatsApp (ex: "Vendas", "Suporte", "Marketing")
- **Conversa**: Uma conversa está sempre vinculada a uma instância específica
- **Mensagem**: Quando você envia uma mensagem, ela é enviada pela instância da conversa

---

## 🔄 Como Funciona o Sistema de Instâncias

### Estrutura de Dados

```
ServiceInstance (Instância)
├── id: UUID
├── name: "WhatsApp Vendas" (exemplo)
├── provider: "EVOLUTION_API"
└── credentials: {
      serverUrl: "https://evolution.covenos.com.br",
      apiToken: "xrgr4qjcxhZ3m5kn2Rc3DdN5qSnhS3cp",
      instanceName: "vendas01"  ← Nome da instância na Evolution
    }

Conversation (Conversa)
├── id: UUID
├── contactId: UUID
├── serviceInstanceId: UUID  ← Vinculada a uma instância
└── status: "OPEN" | "CLOSED"

Message (Mensagem)
├── id: UUID
├── conversationId: UUID  ← Vinculada a uma conversa
└── content: "Texto da mensagem"
```

### Como a Instância é Determinada

**IMPORTANTE**: Você **NÃO** especifica a instância diretamente ao enviar a mensagem. A instância é determinada automaticamente pela **conversa**:

1. Você envia uma mensagem para uma `conversationId`
2. O backend busca a conversa no banco
3. A conversa tem um `serviceInstanceId`
4. O backend busca a instância e usa suas credenciais
5. A mensagem é enviada via Evolution API usando o `instanceName` da instância

**Fluxo Visual:**
```
POST /api/messages/send
  ↓
{ conversationId: "abc-123" }
  ↓
Backend busca Conversation
  ↓
Conversation.serviceInstanceId → "instancia-vendas-id"
  ↓
Backend busca ServiceInstance
  ↓
ServiceInstance.credentials.instanceName → "vendas01"
  ↓
POST https://evolution.covenos.com.br/message/sendText/vendas01
```

---

## 📤 Fluxo Completo de Envio

### Passo a Passo

1. **Frontend envia requisição**
   ```http
   POST /api/messages/send
   Authorization: Bearer {token}
   Content-Type: application/json
   
   {
     "conversationId": "uuid-da-conversa",
     "content": "Olá! Como posso ajudar?",
     "via": "CHAT_MANUAL"
   }
   ```

2. **Backend processa**
   - Valida a conversa (deve existir e estar `OPEN`)
   - Busca a instância vinculada à conversa
   - Cria a mensagem no banco com status `pending`
   - Envia via Evolution API usando as credenciais da instância
   - Atualiza a mensagem com `externalId` e status `sent`
   - Emite evento WebSocket `message:new`

3. **Evolution API recebe e processa**
   - A Evolution API envia a mensagem via WhatsApp
   - Retorna o ID da mensagem (`externalId`)

4. **Frontend recebe resposta**
   - Via resposta HTTP (201 Created)
   - Via WebSocket (evento `message:new`)

---

## 💡 Exemplos Práticos por Instância

### Cenário: Você tem 3 Instâncias

**Instância A - Vendas:**
```json
{
  "id": "instancia-a-id",
  "name": "WhatsApp Vendas",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "token-vendas",
    "instanceName": "vendas01"
  }
}
```

**Instância B - Suporte:**
```json
{
  "id": "instancia-b-id",
  "name": "WhatsApp Suporte",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "token-suporte",
    "instanceName": "suporte01"
  }
}
```

**Instância C - Marketing:**
```json
{
  "id": "instancia-c-id",
  "name": "WhatsApp Marketing",
  "provider": "EVOLUTION_API",
  "credentials": {
    "serverUrl": "https://evolution.covenos.com.br",
    "apiToken": "token-marketing",
    "instanceName": "marketing01"
  }
}
```

### Exemplo 1: Enviar Mensagem pela Instância A (Vendas)

**Passo 1**: Criar ou buscar uma conversa vinculada à Instância A

```http
POST /api/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": "contato-joao-id",
  "serviceInstanceId": "instancia-a-id"  ← Instância A
}
```

**Resposta:**
```json
{
  "id": "conversa-123",
  "contactId": "contato-joao-id",
  "serviceInstanceId": "instancia-a-id",
  "status": "OPEN"
}
```

**Passo 2**: Enviar mensagem (a instância é determinada automaticamente pela conversa)

```http
POST /api/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "conversa-123",  ← Esta conversa está vinculada à Instância A
  "content": "Olá! Bem-vindo ao atendimento de vendas!",
  "via": "CHAT_MANUAL"
}
```

**O que acontece internamente:**
1. Backend busca a conversa `conversa-123`
2. Descobre que ela está vinculada à `instancia-a-id`
3. Busca a instância e obtém `instanceName: "vendas01"`
4. Faz POST para: `https://evolution.covenos.com.br/message/sendText/vendas01`
5. Usa o header: `apikey: token-vendas`

**Resposta:**
```json
{
  "id": "mensagem-456",
  "conversationId": "conversa-123",
  "content": "Olá! Bem-vindo ao atendimento de vendas!",
  "direction": "OUTBOUND",
  "via": "CHAT_MANUAL",
  "externalId": "3EB001A01F2AFFDE364543",
  "status": "sent",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Exemplo 2: Enviar Mensagem pela Instância B (Suporte)

**Passo 1**: Criar conversa vinculada à Instância B

```http
POST /api/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": "contato-maria-id",
  "serviceInstanceId": "instancia-b-id"  ← Instância B
}
```

**Resposta:**
```json
{
  "id": "conversa-789",
  "contactId": "contato-maria-id",
  "serviceInstanceId": "instancia-b-id",
  "status": "OPEN"
}
```

**Passo 2**: Enviar mensagem

```http
POST /api/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "conversa-789",  ← Esta conversa está vinculada à Instância B
  "content": "Olá! Como posso ajudar com seu problema?",
  "via": "CHAT_MANUAL"
}
```

**O que acontece internamente:**
1. Backend busca a conversa `conversa-789`
2. Descobre que ela está vinculada à `instancia-b-id`
3. Busca a instância e obtém `instanceName: "suporte01"`
4. Faz POST para: `https://evolution.covenos.com.br/message/sendText/suporte01`
5. Usa o header: `apikey: token-suporte`

### Exemplo 3: Enviar Mensagem pela Instância C (Marketing)

**Passo 1**: Criar conversa vinculada à Instância C

```http
POST /api/conversations
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": "contato-pedro-id",
  "serviceInstanceId": "instancia-c-id"  ← Instância C
}
```

**Resposta:**
```json
{
  "id": "conversa-456",
  "contactId": "contato-pedro-id",
  "serviceInstanceId": "instancia-c-id",
  "status": "OPEN"
}
```

**Passo 2**: Enviar mensagem

```http
POST /api/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "conversa-456",  ← Esta conversa está vinculada à Instância C
  "content": "Confira nossas promoções especiais!",
  "via": "CHAT_MANUAL"
}
```

**O que acontece internamente:**
1. Backend busca a conversa `conversa-456`
2. Descobre que ela está vinculada à `instancia-c-id`
3. Busca a instância e obtém `instanceName: "marketing01"`
4. Faz POST para: `https://evolution.covenos.com.br/message/sendText/marketing01`
5. Usa o header: `apikey: token-marketing`

---

## 💻 Implementação no Frontend

### Exemplo Completo em JavaScript/TypeScript

```typescript
// Tipos
interface SendMessageRequest {
  conversationId: string;
  content: string;
  via?: 'CHAT_MANUAL' | 'CAMPAIGN';
}

interface MessageResponse {
  id: string;
  conversationId: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  via: string;
  externalId: string | null;
  status: string;
  createdAt: string;
}

// Função para enviar mensagem
async function sendMessage(
  conversationId: string,
  content: string,
  token: string
): Promise<MessageResponse> {
  const response = await fetch('https://api.elsehub.covenos.com.br/api/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      content,
      via: 'CHAT_MANUAL',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao enviar mensagem');
  }

  return response.json();
}

// Exemplo de uso
async function exemploUso() {
  const token = 'seu-token-jwt';
  
  // Conversa vinculada à Instância A (Vendas)
  const conversaVendas = 'conversa-123';
  await sendMessage(conversaVendas, 'Olá! Bem-vindo ao atendimento de vendas!', token);
  
  // Conversa vinculada à Instância B (Suporte)
  const conversaSuporte = 'conversa-789';
  await sendMessage(conversaSuporte, 'Olá! Como posso ajudar?', token);
  
  // Conversa vinculada à Instância C (Marketing)
  const conversaMarketing = 'conversa-456';
  await sendMessage(conversaMarketing, 'Confira nossas promoções!', token);
}
```

### Exemplo com React

```tsx
import React, { useState } from 'react';

interface MessageFormProps {
  conversationId: string;
  onMessageSent?: (message: MessageResponse) => void;
}

const MessageForm: React.FC<MessageFormProps> = ({ conversationId, onMessageSent }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Digite uma mensagem');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://api.elsehub.covenos.com.br/api/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          content: content.trim(),
          via: 'CHAT_MANUAL',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao enviar mensagem');
      }

      const message = await response.json();
      setContent('');
      
      if (onMessageSent) {
        onMessageSent(message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Digite sua mensagem..."
        disabled={loading}
        rows={3}
      />
      
      <button type="submit" disabled={loading || !content.trim()}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  );
};

export default MessageForm;
```

### Exemplo com Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.elsehub.covenos.com.br',
});

// Interceptor para adicionar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Função para enviar mensagem
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<MessageResponse> {
  try {
    const response = await api.post('/api/messages/send', {
      conversationId,
      content,
      via: 'CHAT_MANUAL',
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Erro ao enviar mensagem');
    }
    throw error;
  }
}

// Uso
sendMessage('conversa-123', 'Olá! Como posso ajudar?')
  .then((message) => {
    console.log('Mensagem enviada:', message);
  })
  .catch((error) => {
    console.error('Erro:', error.message);
  });
```

---

## ⚠️ Tratamento de Erros

### Erros Comuns e Como Tratá-los

#### 1. Conversa Não Encontrada (404)

```json
{
  "statusCode": 404,
  "message": "Conversa não encontrada"
}
```

**Causa**: O `conversationId` não existe no banco de dados.

**Solução**: Verificar se o ID da conversa está correto e se a conversa existe.

```typescript
try {
  await sendMessage('conversa-inexistente', 'Olá!');
} catch (error: any) {
  if (error.message.includes('Conversa não encontrada')) {
    console.error('Conversa não existe. Crie uma conversa primeiro.');
  }
}
```

#### 2. Conversa Fechada (400)

```json
{
  "statusCode": 400,
  "message": "Não é possível enviar mensagem para conversa fechada"
}
```

**Causa**: A conversa está com status `CLOSED`.

**Solução**: Não é possível enviar mensagens para conversas fechadas. Você precisa criar uma nova conversa ou reabrir a existente (se houver essa funcionalidade).

```typescript
try {
  await sendMessage('conversa-fechada', 'Olá!');
} catch (error: any) {
  if (error.message.includes('conversa fechada')) {
    // Criar nova conversa ou informar ao usuário
    console.error('Esta conversa está fechada. Crie uma nova conversa.');
  }
}
```

#### 3. Instância Inativa (400)

```json
{
  "statusCode": 400,
  "message": "Instância de serviço inativa"
}
```

**Causa**: A instância vinculada à conversa está com `isActive: false`.

**Solução**: Ativar a instância ou usar uma conversa vinculada a uma instância ativa.

```typescript
try {
  await sendMessage('conversa-com-instancia-inativa', 'Olá!');
} catch (error: any) {
  if (error.message.includes('Instância de serviço inativa')) {
    console.error('A instância desta conversa está inativa. Ative-a primeiro.');
  }
}
```

#### 4. Credenciais da Evolution API Incompletas (400)

```json
{
  "statusCode": 400,
  "message": "Credenciais da Evolution API incompletas"
}
```

**Causa**: A instância não tem todas as credenciais necessárias (`serverUrl`, `apiToken`, `instanceName`).

**Solução**: Verificar e atualizar as credenciais da instância.

```typescript
try {
  await sendMessage('conversa-com-credenciais-incompletas', 'Olá!');
} catch (error: any) {
  if (error.message.includes('Credenciais da Evolution API incompletas')) {
    console.error('Configure as credenciais da instância corretamente.');
  }
}
```

#### 5. Instância Não Encontrada na Evolution API (400)

```json
{
  "statusCode": 400,
  "message": "Instância 'vendas01' não encontrada na Evolution API ou endpoint incorreto. Verifique se a instância existe e está conectada."
}
```

**Causa**: O `instanceName` não existe na Evolution API ou a instância não está conectada.

**Solução**: 
- Verificar se a instância existe na Evolution API
- Verificar se a instância está conectada (status `open`)
- Verificar se o `serverUrl` está correto

```typescript
try {
  await sendMessage('conversa-com-instancia-inexistente', 'Olá!');
} catch (error: any) {
  if (error.message.includes('não encontrada na Evolution API')) {
    console.error('A instância não existe na Evolution API ou não está conectada.');
    // Verificar status da instância ou criar nova instância
  }
}
```

#### 6. Erro de Autenticação (401)

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Causa**: Token JWT inválido, expirado ou ausente.

**Solução**: Fazer login novamente para obter um novo token.

```typescript
try {
  await sendMessage('conversa-123', 'Olá!');
} catch (error: any) {
  if (error.response?.status === 401) {
    // Token expirado, fazer login novamente
    window.location.href = '/login';
  }
}
```

### Tratamento Genérico de Erros

```typescript
async function sendMessageWithErrorHandling(
  conversationId: string,
  content: string
): Promise<MessageResponse> {
  try {
    return await sendMessage(conversationId, content);
  } catch (error: any) {
    // Erro de rede
    if (!error.response) {
      throw new Error('Erro de conexão. Verifique sua internet.');
    }

    const status = error.response.status;
    const message = error.response.data?.message || 'Erro desconhecido';

    switch (status) {
      case 400:
        if (message.includes('conversa fechada')) {
          throw new Error('Esta conversa está fechada. Crie uma nova conversa.');
        }
        if (message.includes('Instância de serviço inativa')) {
          throw new Error('A instância está inativa. Ative-a primeiro.');
        }
        if (message.includes('Credenciais')) {
          throw new Error('Credenciais da instância inválidas. Contate o administrador.');
        }
        throw new Error(message);
      
      case 401:
        throw new Error('Sessão expirada. Faça login novamente.');
      
      case 404:
        throw new Error('Conversa não encontrada. Verifique o ID.');
      
      case 500:
        throw new Error('Erro no servidor. Tente novamente mais tarde.');
      
      default:
        throw new Error(`Erro ${status}: ${message}`);
    }
  }
}
```

---

## 🔍 Troubleshooting

### Problema: Mensagem não está sendo enviada

**Checklist:**
1. ✅ Verificar se o token JWT está válido
2. ✅ Verificar se a conversa existe e está `OPEN`
3. ✅ Verificar se a instância vinculada está `isActive: true`
4. ✅ Verificar se as credenciais da instância estão corretas
5. ✅ Verificar se a instância existe na Evolution API
6. ✅ Verificar se a instância está conectada (status `open` na Evolution)
7. ✅ Verificar logs do backend para erros específicos

### Problema: Mensagem enviada mas não aparece no WhatsApp

**Possíveis causas:**
1. A instância não está conectada na Evolution API
2. O número de telefone está incorreto
3. A Evolution API está com problemas
4. O webhook não está configurado corretamente

**Solução:**
- Verificar status da instância: `GET /api/service-instances/{id}/qrcode`
- Verificar logs da Evolution API
- Verificar se o número está no formato correto (sem `+`, apenas números)

### Problema: Erro 404 ao enviar mensagem

**Possíveis causas:**
1. O `conversationId` está incorreto
2. A conversa foi deletada
3. O endpoint está errado

**Solução:**
- Verificar se o `conversationId` está correto
- Listar conversas: `GET /api/conversations`
- Verificar se a conversa existe antes de enviar

### Problema: Erro "Instância não encontrada na Evolution API"

**Possíveis causas:**
1. O `instanceName` está incorreto nas credenciais
2. A instância não foi criada na Evolution API
3. A instância foi deletada na Evolution API
4. O `serverUrl` está incorreto

**Solução:**
1. Verificar credenciais da instância: `GET /api/service-instances/{id}`
2. Verificar se a instância existe na Evolution API
3. Recriar a instância se necessário: `POST /api/service-instances`

---

## 📝 Resumo Rápido

### Para Enviar uma Mensagem:

1. **Tenha uma conversa vinculada à instância desejada**
   ```http
   POST /api/conversations
   {
     "contactId": "...",
     "serviceInstanceId": "instancia-a-id"  ← Escolha a instância aqui
   }
   ```

2. **Envie a mensagem usando o ID da conversa**
   ```http
   POST /api/messages/send
   {
     "conversationId": "conversa-123",  ← A instância é determinada automaticamente
     "content": "Sua mensagem aqui"
   }
   ```

### Pontos Importantes:

- ✅ **A instância é determinada pela conversa**, não pela mensagem
- ✅ **Uma conversa sempre usa a mesma instância** (não pode mudar)
- ✅ **Para usar outra instância**, crie uma nova conversa vinculada à outra instância
- ✅ **O backend faz tudo automaticamente**: busca a instância, usa as credenciais corretas, envia via Evolution API

---

## 🎓 Exemplo Completo: Sistema com Múltiplas Instâncias

```typescript
// Configuração das instâncias (geralmente vem do backend)
const instancias = {
  vendas: {
    id: 'instancia-a-id',
    name: 'WhatsApp Vendas',
    instanceName: 'vendas01',
  },
  suporte: {
    id: 'instancia-b-id',
    name: 'WhatsApp Suporte',
    instanceName: 'suporte01',
  },
  marketing: {
    id: 'instancia-c-id',
    name: 'WhatsApp Marketing',
    instanceName: 'marketing01',
  },
};

// Função para criar conversa e enviar mensagem
async function criarConversaEEnviarMensagem(
  contactId: string,
  instanciaId: string,
  mensagem: string
) {
  // 1. Criar conversa vinculada à instância
  const conversa = await criarConversa(contactId, instanciaId);
  
  // 2. Enviar mensagem (a instância é determinada automaticamente)
  const mensagemEnviada = await sendMessage(conversa.id, mensagem);
  
  return { conversa, mensagemEnviada };
}

// Exemplos de uso
async function exemplos() {
  const contatoJoao = 'contato-joao-id';
  
  // Enviar pela instância de Vendas
  await criarConversaEEnviarMensagem(
    contatoJoao,
    instancias.vendas.id,
    'Olá! Bem-vindo ao atendimento de vendas!'
  );
  
  // Enviar pela instância de Suporte
  await criarConversaEEnviarMensagem(
    contatoJoao,
    instancias.suporte.id,
    'Olá! Como posso ajudar com seu problema?'
  );
  
  // Enviar pela instância de Marketing
  await criarConversaEEnviarMensagem(
    contatoJoao,
    instancias.marketing.id,
    'Confira nossas promoções especiais!'
  );
}
```

---

## 📚 Referências

- [Documentação de Instâncias](./SERVICE_INSTANCES.md)
- [Documentação de Mensagens](./MASTER_DOCUMENTATION.md#5-mensagens-messages)
- [Fluxo de Mensagens](./MESSAGES_FLOW.md)
- [WebSocket para Tempo Real](./FRONTEND_WEBSOCKET.md)

---

**Última atualização**: Janeiro 2025

