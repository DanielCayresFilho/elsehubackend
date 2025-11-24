# Tabulações & Finalização de Chats

Documento dedicado para explicar como o backend trata classificação de atendimentos (`tabulations`) e encerramento de conversas (`close conversation`). Serve como guia para frontend, squads de operação e suporte.

---

## 1. Conceitos Principais

| Conceito | Descrição |
| --- | --- |
| **Conversa (`Conversation`)** | Sessão ativa entre cliente e operador. Status `OPEN` ou `CLOSED`. |
| **Tabulação (`Tabulation`)** | Motivo de encerramento. Ex.: `Venda Concluída`, `Sem Contato`, `Conversa Expirada`. |
| **Conversa Finalizada (`FinishedConversation`)** | Snapshot histórico gerado no fechamento, com métricas e tabulação aplicada. |
| **Expiração automática** | Conversas sem interação por >24h são fechadas com tabulação "Conversa Expirada". |

---

## 2. Modelo de Dados (Resumido)

- `tabulations`
  - `id`, `name`, `isAutomatic` (default `false`)
  - Relacionada a `finishedConversations`
- `conversations`
  - `status` (`OPEN`/`CLOSED`), `operatorId`, `contactId`, `serviceInstanceId`
- `finished_conversations`
  - Guarda `contactName`, `operatorName`, `tabulationId`, tempos médios e duração

> **Regra**: não é possível excluir uma tabulação se houver `finished_conversations` associadas. O backend retorna `400` com mensagem amigável.

---

## 3. Fluxo de Finalização Manual

1. Operador seleciona uma tabulação (obrigatória).
2. Frontend chama `POST /api/conversations/:id/close`.
3. Backend valida:
   - Conversa existe e está `OPEN`.
   - Tabulação existe.
4. Backend gera registro em `finished_conversations` com métricas.
5. Conversa muda para `CLOSED` e sai da fila do operador.
6. WebSocket emite evento `conversation:closed` (payload básico com `conversationId` + `tabulationId`).

### Endpoint

```
POST /api/conversations/{conversationId}/close
Authorization: Bearer <token>
Roles: ADMIN, SUPERVISOR, OPERATOR
Body:
{
  "tabulationId": "uuid-da-tabulacao"
}
Response: 204 No Content
```

### Erros comuns

| Status | Mensagem | Causa/Solução |
| --- | --- | --- |
| 400 | `Conversa já está fechada` | Tentar fechar duas vezes. Atualize o painel antes de reenviar. |
| 404 | `Conversa não encontrada` | ID inválido ou conversa não pertence ao usuário. |
| 404 | `Tabulação não encontrada` | ID inexistente. Recarregue lista de tabulações. |

---

## 4. Fluxo de Expiração Automática

- Cron job roda a cada hora.
- Conversas `OPEN` sem mensagens por >24h:
  - Tabulação automática `Conversa Expirada` (criada no primeiro boot).
  - Operador é desatribuído.
  - Histórico é gerado igual ao fechamento manual.
- WebSocket notifica operadores/monitores via `conversation:closed` com `tabulationName: "Conversa Expirada"`.

> Frontend deve tratar esse evento para remover a conversa da lista aberta e mostrar badge com o motivo.

---

## 5. Tabulações — Endpoints

| Método | Rota | Roles | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/tabulations` | ADMIN/SUPERVISOR/OPERATOR | Lista ordenada por nome (usar para preencher dropdown). |
| `POST` | `/api/tabulations` | ADMIN/SUPERVISOR | Cria nova tabulação. Nome único. |
| `GET` | `/api/tabulations/{id}` | ADMIN/SUPERVISOR/OPERATOR | Detalhes. |
| `PATCH` | `/api/tabulations/{id}` | ADMIN/SUPERVISOR | Renomeia. Garantimos unicidade. |
| `DELETE` | `/api/tabulations/{id}` | ADMIN/SUPERVISOR | Remove se **não** houver históricos associados. |

### Exemplo de criação

```http
POST /api/tabulations
{
  "name": "Venda Concluída"
}

201 Created
{
  "id": "tab-123",
  "name": "Venda Concluída"
}
```

### Respostas de erro

- `400` — `"Já existe uma tabulação com esse nome"`
- `400` — `"Não é possível remover uma tabulação com conversas finalizadas associadas"`
- `404` — `"Tabulação não encontrada"`

---

## 6. Checklist para o Frontend

1. **Carregar tabulações** ao abrir o modal de finalização (`GET /api/tabulations`).
2. **Validar seleção**: botão "Finalizar" só habilita com `tabulationId`.
3. **Tratar loading e erros** ao chamar `POST /conversations/:id/close`.
4. **Atualizar UI**:
   - Remover conversa da coluna "Ativos".
   - Adicionar a `Finished Conversations` (caso haja tela) ou exibir toast.
5. **Escutar WebSocket** `conversation:closed` para refletir expirações automáticas/transferências.
6. **Evitar duplo envio**: desabilitar botão após clique até resposta do backend.

---

## 7. Checklist para o Backend (já implementado)

- [x] Validação de tabulação obrigatória.
- [x] Registro de `finished_conversations` com métricas (`avgResponseTimeUser`, `avgResponseTimeOperator`).
- [x] Bloqueio de exclusão de tabulação em uso.
- [x] Tabulação "Conversa Expirada" criada automaticamente (script de seed).
- [x] Expiração automática via Cron.
- [x] Logs detalhados em `ConversationsService.closeConversation`.

---

## 8. Integração com Relatórios

- `GET /api/reports/finished-conversations` permite filtrar por `tabulationId`.
- Útil para BI entender motivos mais frequentes e performance por operador.
- Cada registro traz:
  - `tabulationName`
  - `durationSeconds`
  - `avgResponseTimeUser`
  - `avgResponseTimeOperator`

---

## 9. Boas Práticas Operacionais

- Mantenha um conjunto enxuto de tabulações (5–10) para facilitar análise.
- Use nomes claros e orientados à ação: `Venda Concluída`, `Sem Interesse`, `Retornar Depois`.
- Treine operadores para escolher o motivo correto; isso alimenta os relatórios de performance.
- Configure alertas no frontend quando a conversa estiver próxima de 24h sem interação, evitando expirações automáticas desnecessárias.

---

## 10. Próximos Passos Possíveis

- Permitir comentários opcionais no fechamento (justificativa customizada).
- Permitir reabertura manual de conversas fechadas (workflow supervisionado).
- Integrar tabulações com automações (ex.: disparar campanha ao marcar `Sem Contato`).

---

> Qualquer alteração na lógica de tabulação/finalização deve ser refletida neste documento e no `docs/MASTER_DOCUMENTATION.md` para manter o time de frontend e operações alinhado.

