## Guia de Implementação do Login no Frontend

Este documento descreve como integrar o fluxo de autenticação do backend Elsehu no frontend, cobrindo endpoints, estrutura dos tokens JWT, diretrizes de armazenamento e como renovar sessões de forma segura.

---

### 1. Visão geral do fluxo
1. Usuário envia `email` e `password` para `POST /auth/login`.
2. Backend valida credenciais, verifica se o usuário está ativo e retorna:
   - `user`: payload sanitizado com os campos do usuário.
   - `tokens`: `accessToken`, `refreshToken` e os tempos de expiração informados em string (ex.: `900s`, `7d`).
3. O frontend guarda os tokens seguindo as recomendações abaixo.
4. Cada requisição autenticada envia o `accessToken` no header `Authorization: Bearer <token>`.
5. Quando o access token expira, o frontend usa o `refreshToken` em `POST /auth/refresh` para obter um par novo.
6. Opcionalmente, use `GET /auth/profile` para reidratar o contexto do usuário autenticado.

---

### 2. Estrutura dos tokens
- **Access token**
  - Assinado com `jwt.access.secret`.
  - Expira rápido (default `900s` ≈ 15 min).
  - Payload (`sub`, `email`, `role`) é utilizado pelos guards e decorators (`@CurrentUser`, `@Roles`).
- **Refresh token**
  - Assinado com `jwt.refresh.secret`.
  - Expira em `jwt.refresh.expiresIn` (default `7d`).
  - Mesmo payload do access token, apenas com validade maior.

Ambos são JWTs padrão; nenhuma informação sensível adicional é exposta além do identificador (`sub`), email e papel. Não armazene o password hash ou campos internos.

---

### 3. Endpoints relevantes
- `POST /auth/login`
  ```json
  { "email": "user@dominio.com", "password": "••••••" }
  ```
  Resposta:
  ```json
  {
    "user": { "id": "...", "name": "...", "email": "...", "role": "ADMIN", "...": "..." },
    "tokens": {
      "accessToken": "<jwt>",
      "refreshToken": "<jwt>",
      "accessTokenExpiresIn": "900s",
      "refreshTokenExpiresIn": "7d"
    }
  }
  ```
- `POST /auth/refresh`
  ```json
  { "refreshToken": "<jwt>" }
  ```
  Retorna o mesmo formato de resposta do login, inclusive com o usuário.
- `GET /auth/profile`
  - Requer `Authorization: Bearer <accessToken>`.
  - Retorna apenas o `user`.

---

### 4. Armazenamento seguro dos tokens
**Objetivo:** minimizar exposição ao XSS enquanto permite persistência suficiente para manter sessão.

1. **Access token**
   - Preferencial: manter em memória (ex.: Zustand/Redux) e sincronizar com `sessionStorage` para suportar refresh da página.
   - Nome sugerido: `elsehu.accessToken`.
   - Ao carregar a aplicação, tente restaurar o token da `sessionStorage`, valide a expiração (ver item 5), e carregue para memória.
2. **Refresh token**
   - Ideal: armazenar em `cookie` com `Secure`, `SameSite=Lax` e tempo igual ao exp. do token. O front não consegue marcar `HttpOnly`, então mantenha o cookie inacessível por JS usando um subdomínio dedicado ou, se possível, troque o fluxo para que o backend escreva o cookie.
   - Alternativa (quando cookie não for viável): guardar em `localStorage` (`elsehu.refreshToken`) com criptografia simétrica no lado do cliente. Apesar de não eliminar o risco de XSS, reduz exposição. Monitore vulnerabilidades XSS com rigor.
3. **Fatores adicionais**
   - Sempre limpe ambos tokens em `logout`.
   - Nunca serialize tokens dentro de URLs ou query params.

---

### 5. Gerenciamento de expiração
1. O backend devolve o tempo de expiração como string (`900s`, `7d`).
2. No frontend, converta para uma data de expiração absoluta no momento em que salvar o token.
3. Antes de cada requisição, verifique se o `accessToken` expira nos próximos N segundos (ex.: 30 s). Se sim, dispare o fluxo de refresh preventivo.
4. Em caso de erro `401`:
   - Confira se já existe uma tentativa de refresh em andamento para evitar chamadas paralelas (mutex).
   - Caso o refresh falhe (token inválido/expirado), force logout.

Sugestão de helper:
```ts
const shouldRefresh = (expiresAt: number, now = Date.now()) =>
  expiresAt - now < 30_000;
```

---

### 6. Interceptor/axios middleware
1. Configure um interceptor que injete automaticamente `Authorization` com o access token em cada request.
2. Interceptor de respostas deve:
   - Capturar `401`/`403`.
   - Verificar se já tentou refresh para essa requisição. Se não, chamar `refresh`, atualizar tokens e repetir a request original.
3. Preserve a fila de requests enquanto o refresh ocorre para que apenas a primeira dispare o endpoint.

Pseudo-implementação:
```ts
api.interceptors.response.use(
  resp => resp,
  async error => {
    if (error.response?.status !== 401) throw error;
    await authStore.ensureFreshTokens();
    return api.request(error.config);
  }
);
```

---

### 7. Login, refresh e logout (passo a passo)
**Login**
1. Validar campos no frontend.
2. Enviar `POST /auth/login`.
3. Salvar tokens conforme item 4.
4. Persistir dados do usuário (contexto global) e navegar para o dashboard.

**Refresh automático**
1. Função `ensureFreshTokens()` verifica `shouldRefresh`.
2. Se for necessário, envia `POST /auth/refresh` com o refresh token do cookie/armazenamento.
3. Atualiza access token, refresh token e expirações retornadas.

**Logout**
1. Remover tokens de memória, `sessionStorage`, `localStorage` ou cookies.
2. Resetar estado global do usuário.
3. Redirecionar para a tela de login.
4. Opcional: invalidar tokens no backend quando o suporte for implementado (não há endpoint atualmente).

---

### 8. Tratamento de erros
- Mensagens genéricas (“credenciais inválidas”) são intencionais; exiba feedback amigável.
- Em falhas de rede, mantenha mensagem “Não foi possível conectar ao servidor. Tente novamente”.
- Para `Unauthorized` durante refresh, faça logout imediato e oriente o usuário a realizar login novamente.
- Registre logs no console apenas em modo desenvolvimento; em produção, envie para ferramenta de observabilidade.

---

### 9. Checklist para homologação
- [ ] Login envia payload conforme DTO (email válido, senha com >= 6 chars).
- [ ] Access token salvo em memória e restaura após refresh da página.
- [ ] Refresh token persistido com política definida (cookie/localStorage) e removido no logout.
- [ ] Interceptor reenvia automaticamente requisições após refresh.
- [ ] Fluxo de logout cobre expirados/invalid refresh.
- [ ] `GET /auth/profile` usado para reidratar usuário após reload.
- [ ] Telemetria de erros/reportes implementada.

Seguindo estas orientações o frontend ficará alinhado com a implementação atual do backend, com tokens protegidos e fluxo consistente para os usuários.

