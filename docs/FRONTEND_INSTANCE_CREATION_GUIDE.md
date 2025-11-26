## Guia Complementar: Criação e Gestão de Instâncias

Este guia orienta o frontend sobre como implementar as telas e fluxos relacionados às instâncias de atendimento (WhatsApp / Evolution / Meta) consumindo os endpoints `service-instances` do backend Elsehu.

---

### 1. Visão geral do fluxo
1. Apenas usuários com papel `ADMIN` podem criar, atualizar ou remover instâncias (`@Roles(Role.ADMIN)` no backend).
2. Para listagem e leitura (`GET`), supervisores também têm acesso.
3. Fluxo típico:
   - Abrir tela de listagem (`GET /service-instances`).
   - Acionar modal/formulário para criar (`POST /service-instances`).
   - Após criar Evolution API, opcionalmente exibir QR Code (`GET /service-instances/:id/qrcode`) até que o dispositivo seja pareado.
   - Permitir editar (`PATCH`) ou inativar (`DELETE`, que apenas marca como inativa).

---

### 2. Endpoints e contratos
- `GET /service-instances?includeInactive=true|false`
  - Permite filtrar instâncias inativas (default: só as ativas).
- `GET /service-instances/:id`
  - Retorna dados completos.
- `POST /service-instances`
  - Payload: `CreateServiceInstanceDto`.
- `PATCH /service-instances/:id`
  - Payload parcial: `UpdateServiceInstanceDto`.
- `DELETE /service-instances/:id`
  - Marca `isActive=false`. Backend retorna `204`.
- `GET /service-instances/:id/qrcode`
  - Disponível apenas para Evolution API. Retorna `{ base64 }`, `{ pairingCode }`, ou mensagem “Instância já conectada”.

**Resposta base (`ServiceInstanceResponseDto`):**
```json
{
  "id": "uuid",
  "name": "Financeiro 01",
  "phone": "+5511999999999",
  "provider": "EVOLUTION_API",
  "credentials": { "...": "..." },
  "isActive": true,
  "createdAt": "2025-11-24T12:00:00.000Z",
  "updatedAt": "2025-11-24T12:10:00.000Z"
}
```

---

### 3. Formulário de criação
Campos obrigatórios (`CreateServiceInstanceDto`):
| Campo     | Tipo     | Regras                                    |
|-----------|----------|-------------------------------------------|
| `name`    | string   | Obrigatório; trim no backend; exibir erro se vazio |
| `phone`   | string   | Obrigatório; usar máscara +55 (??) e validar E.164 |
| `provider`| enum     | `EVOLUTION_API` ou `OFFICIAL_META` (consultar `InstanceProvider`) |
| `credentials` | objeto | chave/valor dependendo do provider (ver seção 4) |

Recomendações:
- Validar client-side antes de enviar para reduzir round-trips.
- Usar `select` bloqueando valores não suportados.
- Exibir feedback durante criação, pois Evolution pode levar alguns segundos.

---

### 4. Credenciais por provider

**EVOLUTION_API**
```json
{
  "instanceName": "financeiro-01",
  "apiToken": "xxxx",
  "serverUrl": "https://evolution.suaempresa.com"
}
```
- Backend cria a instância na Evolution e tenta configurar o webhook automaticamente.
- Exibir instruções para obter `apiToken` e URL com o time de infraestrutura.
- Validar URL (https obrigatório) e remover `/` final antes de enviar (opcional no front; backend já trata).

**OFFICIAL_META**
```json
{
  "wabaId": "123456789",
  "phoneId": "987654321",
  "accessToken": "EAA..."
}
```
- Usado para integrações WhatsApp Business Cloud.
- Garantir que o access token tenha permissões necessárias.

**Validações adicionais**
- Em ambos casos, `credentials` deve ser objeto JSON válido.
- Backend rejeita payloads incompletos com `400 BadRequest` e mensagem específica; repasse esse texto ao usuário.

---

### 5. Pós-criação e QR Code (Evolution)
1. Após `POST` bem-sucedido, verificar se provider é Evolution.
2. Renderizar componente com status da conexão:
   - Chamar `GET /service-instances/:id/qrcode`.
   - Se retornar `base64`, exibir QR Code.
   - Se retornar `pairingCode`, mostrar código alfanumérico.
   - Se retornar `message` (“Instância já conectada”), apenas mostrar status conectado.
3. Atualizar o QR a cada 5–10 segundos enquanto o estado não for “conectado”. Requisições simultâneas devem ser canceladas ao desmontar o componente.
4. Caso o endpoint responda erro:
   - Exibir mensagem “Não foi possível recuperar o QR Code. Verifique credenciais.”
   - Fornecer botão “Tentar novamente”.

---

### 6. Atualização e inativação
- **Editar**: permitir alterar `name`, `phone`, `provider`, `credentials`, `isActive`.
  - Ao trocar provider, solicitar novamente todas as credenciais (não reutilizar campos antigos).
  - Usar `PATCH /service-instances/:id`.
- **Remover**: chama `DELETE /service-instances/:id`.
  - O backend apenas seta `isActive=false`; mantenha a instância visível em listas com filtro “Mostrar inativas”.
  - Exibir alerta confirmando que a ação desativará o envio/recebimento.

---

### 7. Boas práticas de UX
- Exibir etiquetas com provider (ex.: badge “Evolution” vs “Meta”).
- Mostrar status:
  - `Ativa` / `Inativa`.
  - Última atualização (`updatedAt`).
- Oferecer filtros por provider e busca pelo nome/telefone.
- Para Evolution, destacar instruções de pareamento (ex.: “Abra o WhatsApp > Dispositivos conectados > Conectar”).
- Logar erros técnicos apenas em ambiente dev; em produção, use sistema de observabilidade.

---

### 8. Tratamento de erros e segurança
- `401/403`: usuário sem permissão → redirecionar ou exibir “Você não tem acesso”.
- `400 BadRequest`: exibir detalhes retornados (ex.: “Credenciais da Evolution API incompletas…”).
- `404 NotFound`: instância removida; recarregar listagem.
- Sanitizar qualquer campo de texto exibido (nome) para evitar XSS.
- Nunca mostrar `accessToken` completo da Meta; em telas de edição, use campo “colar novo token” e nunca preencha o atual.

---

### 9. Checklist de homologação
- [ ] Form cria instância com ambos providers.
- [ ] Validação de telefone, nome e credenciais client-side.
- [ ] Feedback de loading durante chamadas longas.
- [ ] QR Code da Evolution atualiza automaticamente e trata erros.
- [ ] Edição respeita regras por provider.
- [ ] Inativação remove a instância da lista padrão mas aparece com filtro “inativas”.
- [ ] Mensagens de erro amigáveis com base nas respostas do backend.

Seguindo este guia, o frontend manterá paridade com o backend e garantirá uma experiência confiável para criação e manutenção das instâncias de atendimento.

