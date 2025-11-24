# Guia de Mídias (Frontend)

Documento único explicando como o frontend deve tratar imagens, áudios e documentos recebidos pelo chat em tempo real.

---

## 1. O que o backend faz automaticamente

1. Evolution envia o webhook com a mídia.
2. O backend baixa o arquivo direto da Evolution (`axios` com `apikey` da instância).
3. O arquivo é salvo em disco: `storage/messages/<conversationId>/<arquivo>`.
4. A mensagem no banco recebe:
   - `hasMedia: true`
   - `mediaType`: `IMAGE`, `AUDIO`, `DOCUMENT`
   - `mediaFileName`, `mediaMimeType`, `mediaSize`, `mediaCaption`
   - `mediaStoragePath`: exemplo `messages/d9a1e6.../2025-11-24-comprovante.jpg`
   - URLs para o frontend: `mediaPublicUrl`, `mediaDownloadPath`
5. O WebSocket envia o evento `message:new` já com esses campos.

---

## 2. Campos disponíveis na mensagem

```json
{
  "id": "msg-123",
  "hasMedia": true,
  "mediaType": "IMAGE",
  "mediaFileName": "comprovante.jpg",
  "mediaMimeType": "image/jpeg",
  "mediaSize": 204800,
  "mediaCaption": "Segue DOC",
  "mediaPublicUrl": "/media/messages/d9a1.../2025-11-24-comprovante.jpg",
  "mediaDownloadPath": "/media/messages/d9a1.../2025-11-24-comprovante.jpg"
}
```

- **`mediaPublicUrl`**: URL estática, não exige token. Use diretamente em `<img src>`, `<audio src>`, `<a href download>`.
- **`mediaDownloadPath`**: fallback autenticado. Quando o arquivo local expira, ele passa automaticamente para `/api/messages/:id/media` (exige `Authorization: Bearer <token>`).
- **`content`**: texto padrão `[Imagem recebida]` quando não há legenda.

---

## 3. Como renderizar no frontend

1. **Imagem**
   ```tsx
   {message.hasMedia && message.mediaType === 'IMAGE' && message.mediaPublicUrl ? (
     <img src={message.mediaPublicUrl} alt={message.mediaCaption ?? 'Imagem'} />
   ) : null}
   ```
2. **Áudio**
   ```tsx
   {message.mediaType === 'AUDIO' && (
     <audio controls src={message.mediaPublicUrl ?? message.mediaDownloadPath ?? undefined} />
   )}
   ```
3. **Documento**
   ```tsx
   <a href={message.mediaPublicUrl ?? message.mediaDownloadPath ?? '#'} download={message.mediaFileName}>
     {message.mediaFileName ?? 'Baixar documento'}
   </a>
   ```
4. **Fallback (arquivo expirado):**
   - Se ambos `mediaPublicUrl` e `mediaDownloadPath` vierem `null`, exiba “Mídia expirada”.
   - Opcional: botão para solicitar reenvio ao cliente.

---

## 4. Retenção e limpeza

- Arquivos locais são mantidos por **3 dias** (variável `MEDIA_RETENTION_DAYS`).
- Um cron diário remove os arquivos vencidos e limpa `mediaStoragePath`.
- Após a remoção:
  - `mediaPublicUrl` = `null`
  - `mediaDownloadPath` volta a ser `/api/messages/:id/media` (tentativa remota). Se também falhar, o backend retorna 404.

**Como tratar no frontend:**

```tsx
if (!message.mediaPublicUrl && !message.mediaDownloadPath) {
  return <span>Mídia expirada</span>;
}
```

---

## 5. Endpoints úteis

| Endpoint | Descrição | Autenticação |
| --- | --- | --- |
| `GET /media/...` | Arquivo estático salvo localmente | Não requer token |
| `GET /api/messages/:id/media` | Fallback streaming da Evolution | Requer `Authorization` |
| `GET /api/messages/conversation/:conversationId` | Lista geral (inclui campos de mídia) | `Authorization` |
| WebSocket `message:new` | Evento em tempo real com todos os campos | Token JWT válido |

---

## 6. Casos especiais

- **Stickers/Vídeos:** ainda não suportados. O backend envia mensagem automática informando isso.
- **Envio de mídia pelo operador:** ainda não implementado. Usar apenas texto por enquanto.
- **Mídia duplicada:** o backend ignora `fromMe: true`, então não haverá duplicidade no feed.

---

## 7. Checklist de implementação

- [ ] Mapear `mediaPublicUrl` e `mediaDownloadPath` no model de mensagens do frontend.
- [ ] Criar componentes específicos para imagem, áudio e documento.
- [ ] Tratar estado “carregando” enquanto o arquivo baixa (principalmente para documentos grandes).
- [ ] Mostrar placeholder/ícone quando `hasMedia` é verdadeiro, mas a URL ainda não chegou.
- [ ] Tratar cenário “Mídia expirada”.

Com isso o frontend consegue exibir mídias recebidas sem precisar lidar com Evolution ou credenciais sensíveis. Qualquer dúvida sobre novos tipos, abra chamado. :)

