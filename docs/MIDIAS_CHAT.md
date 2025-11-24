# Suporte a Mídias no Chat em Tempo Real

## 1. Tipos Suportados

- **Imagem** (`IMAGE`) – fotos enviadas pelo cliente.
- **Áudio** (`AUDIO`) – notas de voz/áudios.
- **Documento** (`DOCUMENT`) – PDFs, planilhas, etc.

Esses tipos são armazenados no banco em `messages.mediaType` e ficam disponíveis para download via endpoint dedicado.

## 2. Fluxo de Recebimento

1. Evolution envia o webhook com `messages.upsert`.
2. O backend identifica o tipo de mídia, salva os metadados na tabela `messages`:
   - `mediaType`, `mediaFileName`, `mediaMimeType`, `mediaSize`, `mediaCaption`.
3. `content` recebe um texto padrão (`[Imagem recebida]`, `[Áudio recebido]`, `[Documento recebido]`) caso não exista legenda.
4. O frontend recebe o evento `message:new` com:
   ```json
   {
     "hasMedia": true,
     "mediaType": "IMAGE",
     "mediaFileName": "foto.jpg",
     "mediaMimeType": "image/jpeg",
     "mediaSize": 204800,
     "mediaDownloadPath": "/api/messages/<id>/media"
   }
   ```
5. Para exibir/baixar o arquivo, o frontend chama `GET /api/messages/:id/media` usando o token JWT.

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

Responde com o arquivo original (stream). O backend faz proxy junto à Evolution API usando o `apikey`, mantendo as credenciais seguras.

## 6. Considerações para o Frontend

- Use `hasMedia` para decidir se renderiza componente de mídia.
- Sempre utilize `mediaDownloadPath` ao baixar/exibir arquivos (não use `mediaUrl` real, ele não é exposto).
- Para áudios, use o `<audio controls>` consumindo o endpoint.
- Para imagens, é possível gerar um `blob` e exibir com `<img>`.
- Para documentos, faça o download ou abra em nova aba (dependendo do tipo/MIME).

## 7. Próximos Passos Sugeridos

- Implementar upload/forward de mídia enviada pelo operador (Evolution `sendFile`/`sendPTT`).
- Criar thumbnails/previews no backend para agilizar a renderização de imagens grandes.

