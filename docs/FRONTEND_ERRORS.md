# Guia de Tratamento de Erros no Frontend

Este documento orienta como o frontend deve interpretar e exibir as mensagens de erro retornadas pelo backend, garantindo uma experiência amigável para o usuário final.

## Estrutura Padrão de Erro

Todas as requisições com erro retornarão um JSON com a seguinte estrutura base:

```json
{
  "statusCode": 400,
  "timestamp": "2025-11-22T15:30:00.000Z",
  "path": "/api/endpoint",
  "message": "Mensagem de erro ou Objeto de erro"
}
```

### Variações do Campo `message`

O campo `message` pode vir em dois formatos principais:

1. **String Simples** (Erros de Regra de Negócio):
   ```json
   "message": "Não é possível remover este contato pois ele possui conversas associadas"
   ```

2. **Objeto/Array** (Erros de Validação de Campos):
   Quando múltiplos campos estão inválidos (ex: formulário), o NestJS retorna os detalhes.
   ```json
   "message": {
     "message": [
       "email deve ser um endereço de email válido",
       "password deve ter no mínimo 6 caracteres"
     ],
     "error": "Bad Request",
     "statusCode": 400
   }
   ```

---

## Lógica Sugerida para Exibição (Pseudocódigo)

Ao receber um erro `err` da API:

```javascript
function getUserFriendlyMessage(err) {
  const errorData = err.error; // O corpo JSON da resposta

  // 1. Caso message seja uma string direta
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }

  // 2. Caso message seja um objeto contendo um array de mensagens (Validação)
  if (Array.isArray(errorData.message?.message)) {
    // Retorna a primeira mensagem ou junta todas
    return errorData.message.message[0]; 
    // Ou: return errorData.message.message.join(', ');
  }
  
  // 3. Caso message seja um objeto com uma string message
  if (typeof errorData.message?.message === 'string') {
    return errorData.message.message;
  }

  // 4. Fallback genérico
  return "Ocorreu um erro inesperado. Tente novamente.";
}
```

---

## Cenários Comuns e Mensagens

### 1. Deleção Bloqueada (Erro 400)
Acontece ao tentar excluir um registro que tem vínculos (ex: Contato com Conversas, Template em Campanha).

- **Cenário**: Excluir Contato com conversas.
- **Backend Retorna**: `400 Bad Request`
- **Mensagem**: "Não é possível remover este contato pois ele possui conversas ou registros associados"
- **Ação Front**: Exibir Toast de Erro/Alerta.

- **Cenário**: Excluir Template usado em Campanha.
- **Backend Retorna**: `400 Bad Request`
- **Mensagem**: "Não é possível remover um template que está sendo usado em campanhas"
- **Ação Front**: Exibir Toast de Erro.

- **Cenário**: Excluir Instância com dados.
- **Backend Retorna**: `400 Bad Request`
- **Mensagem**: "Não é possível remover uma instância com conversas ou campanhas associadas"

### 2. Validação de Formulário (Erro 400)
Acontece ao enviar dados incompletos ou inválidos.

- **Cenário**: Criar Usuário com email inválido.
- **Backend Retorna**: `400 Bad Request` com array de mensagens.
- **Mensagem**: "email must be an email"
- **Ação Front**: Exibir erro abaixo do campo ou Toast genérico "Verifique os dados do formulário".

### 3. Duplicidade (Erro 409)
Acontece ao tentar criar algo que deve ser único.

- **Cenário**: Criar Usuário com email já existente.
- **Backend Retorna**: `409 Conflict`
- **Mensagem**: "E-mail já está em uso"
- **Ação Front**: Exibir Toast "Este e-mail já está cadastrado".

- **Cenário**: Criar Tabulação com nome repetido.
- **Backend Retorna**: `400 Bad Request` (Tratado manualmente)
- **Mensagem**: "Já existe uma tabulação com esse nome"

### 4. Login e Autenticação (Erro 401)

- **Cenário**: Senha errada ou usuário inativo.
- **Backend Retorna**: `401 Unauthorized`
- **Mensagem**: "Credenciais inválidas"
- **Ação Front**: Exibir "E-mail ou senha incorretos".

### 5. Recurso Não Encontrado (Erro 404)

- **Cenário**: Acessar ou editar algo que foi excluído por outro admin.
- **Backend Retorna**: `404 Not Found`
- **Mensagem**: "Usuário não encontrado", "Contato não encontrado", etc.
- **Ação Front**: Exibir Toast e, se possível, atualizar a lista/navegar para trás.

---

## Tabela de Resumo para o Desenvolvedor Front

| Ação | Recurso | Possível Erro | Mensagem do Backend | Sugestão UX |
|---|---|---|---|---|
| **Login** | Auth | 401 | "Credenciais inválidas" | "Email ou senha incorretos" |
| **Criar** | Todos | 400 | (Array de validações) | "Preencha todos os campos obrigatórios" |
| **Criar** | User/Contato | 409/400 | "Já existe..." | "Registro duplicado" |
| **Excluir** | Contato | 400 | "Não é possível remover... possui conversas..." | Alerta explicando o vínculo |
| **Excluir** | Template | 400 | "Não é possível remover... usado em campanhas" | Alerta explicando o vínculo |
| **Excluir** | Instância | 400 | "Não é possível remover... com conversas..." | Alerta explicando o vínculo |
| **QR Code**| Instância | 400 | "Credenciais inválidas..." | "Verifique as configurações da instância" |

Use este guia para padronizar os componentes de feedback (Toasts, Alerts, Modais) do sistema.

