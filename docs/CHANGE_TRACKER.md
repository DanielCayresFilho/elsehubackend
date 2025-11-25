# Documento Único de Mudanças

Este arquivo centraliza o planejamento e o histórico das alterações coordenadas no backend. Sempre siga esta ordem para cada mudança:

1. **Ler** este documento para entender o contexto e as decisões já tomadas.
2. **Aplicar** as alterações no código seguindo o plano descrito aqui.
3. **Atualizar** este documento descrevendo o que foi feito (ou ajustes no plano) antes de partir para a próxima mudança.

---

## Mudanças em Andamento / Planejadas

*(nenhuma neste momento)*

---

## Histórico

### [2025-11-25] Implementar envio real para instâncias `OFFICIAL_META`
- **O que foi feito**:
  - Adicionado `sendViaMetaAPI` em `MessagesService` com chamada real ao Graph API (`/{version}/{phoneId}/messages`).
  - Normalização de telefone extraída para método compartilhado.
  - Novos helpers para configurar versão/base URL via credenciais/env.
  - Documentações (`BACKEND_OVERVIEW`, `MASTER_DOCUMENTATION`, `MESSAGES_FLOW`) atualizadas para refletir suporte real à Meta.
- **Observações**: credenciais esperadas (`phoneId`, `accessToken`, opcional `apiVersion`/`graphApiUrl`). Status inicial da mensagem definido como `sent` após resposta com `messages[0].id`.

### [2025-11-25] Pacote de melhorias das instâncias
- **O que foi feito**:
  - Campo `phone` adicionado em `service_instances`, DTOs e responses; novas instâncias exigem o número associado.
  - `GET /service-instances` agora retorna apenas registros ativos por padrão (`?includeInactive=true` disponível); `DELETE` apenas desativa (`isActive=false`).
  - Envio de mensagens (`MessagesService.send`) valida se a instância da conversa está ativa; campanhas já possuíam essa checagem.
  - Evolution webhook é configurado automaticamente com `webhook_base64: true`.
  - Documentações (`BACKEND_OVERVIEW.md`, `SERVICE_INSTANCES.md`, `MESSAGES_FLOW.md`) atualizadas com filtros, phone e comportamento de desativação.
- **Observações**: Operações que dependem de instâncias inativas devem primeiro reativá-las via `PATCH /service-instances/:id { "isActive": true }`.


