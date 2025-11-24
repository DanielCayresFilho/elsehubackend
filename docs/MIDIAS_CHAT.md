# Suporte a Mídias no Chat em Tempo Real

## 1. Tipos Suportados

- **Imagem** (`IMAGE`) – fotos enviadas pelo cliente.
- **Áudio** (`AUDIO`) – notas de voz/áudios.
- **Documento** (`DOCUMENT`) – PDFs, planilhas, etc.

Esses tipos são armazenados no banco em `messages.mediaType`. O arquivo bruto é baixado da Evolution, salvo em disco (`storage/messages/<conversationId>/...`) e servido publicamente via `/media/...`.

## 2. Fluxo de Recebimento

1. Evolution envia o webhook com `messages.upsert`.
2. O backend identifica o tipo de mídia, salva os metadados na tabela `messages`:
   - `mediaType`, `mediaFileName`, `mediaMimeType`, `mediaSize`, `mediaCaption`.
3. `content` recebe um texto padrão (`[Imagem recebida]`, `[Áudio recebido]`, `[Documento recebido]`) caso não exista legenda.
4. O backend baixa a mídia, salva localmente e preenche os campos:
   - `mediaStoragePath`: caminho relativo (`messages/<conversationId>/<file>`).
   - `mediaPublicUrl`: `/media/messages/<conversationId>/<file>`.
   - `mediaDownloadPath`: igual ao `mediaPublicUrl` (fallback para `/api/messages/:id/media` se ainda não houver cópia local).
5. O frontend recebe o evento `message:new` com:
   ```json
   {
     "hasMedia": true,
     "mediaType": "IMAGE",
     "mediaFileName": "foto.jpg",
     "mediaMimeType": "image/jpeg",
     "mediaSize": 204800,
     "mediaPublicUrl": "/media/messages/d9a1.../2025-11-24-foto.jpg",
     "mediaDownloadPath": "/media/messages/d9a1.../2025-11-24-foto.jpg"
   }
   ```
6. Para renderizar a imagem/áudio no chat, basta usar `mediaPublicUrl` (é um endpoint estático). Em cenários de fallback utilize `mediaDownloadPath` (`/api/messages/:id/media`), que exige token.

## 3. Fluxo de Envio

Ainda suportamos **apenas envio de texto** (`sendText`). O backend já possui a estrutura de mídia no banco para suportar envio futuro. Até lá, operadores devem enviar arquivos diretamente pelo WhatsApp Business App ou Evolution Manager.

## 4. Tipos Não Suportados (Avisos)

- **Sticker**
- **Vídeo**

Quando recebidos, registramos uma mensagem automática na conversa informando: _"Recebemos um {sticker/vídeo}, mas esse tipo de mídia ainda não é suportado."_ Nada é salvo em `mediaType`.

## 5. Endpoint de Download

```
GET /api/messages/:id/media
Authorization: Bearer <token>
```

Responde com o arquivo original (stream). O backend lê o arquivo local se ele existir; caso já tenha sido limpo (ver seção 7), faz proxy junto à Evolution API.

## 6. Considerações para o Frontend

- Use `hasMedia` para decidir se renderiza componente de mídia.
- Sempre utilize `mediaDownloadPath` ao baixar/exibir arquivos (não use `mediaUrl` real, ele não é exposto).
- Para áudios, use o `<audio controls>` consumindo o endpoint.
- Para imagens, é possível gerar um `blob` e exibir com `<img>`.
- Para documentos, faça o download ou abra em nova aba (dependendo do tipo/MIME).

## 7. Retenção e Limpeza Automática

- Toda mídia local é mantida por **3 dias** (`MEDIA_RETENTION_DAYS`).
- Um cron diário remove arquivos vencidos e limpa `mediaStoragePath` do banco.
- Após o purge, `mediaPublicUrl` passa a ser `null` e `mediaDownloadPath` volta a `/api/messages/:id/media`. O frontend deve tratar ausência de URL exibindo algo como “Mídia expirada”.

## 8. Próximos Passos Sugeridos

- Implementar upload/forward de mídia enviada pelo operador (Evolution `sendFile`/`sendPTT`).
- Criar thumbnails/previews no backend para agilizar a renderização de imagens grandes.

