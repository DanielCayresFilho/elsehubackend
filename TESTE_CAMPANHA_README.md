# 🧪 Guia de Teste de Campanha

Este guia explica como testar o disparo de uma campanha usando o script Python.

## 📋 Pré-requisitos

1. Python 3 instalado
2. Biblioteca `requests` instalada: `pip install requests`
3. Credenciais de acesso (email e senha de ADMIN ou SUPERVISOR)
4. Uma instância de serviço ativa no sistema

## 📁 Arquivos Criados

- `test_campaign.csv` - Arquivo CSV com o telefone de teste (5514988117592)
- `test_campaign_disparo.py` - Script Python para testar o disparo

## 🚀 Como Usar

### Opção 1: Variáveis de Ambiente (Recomendado)

```bash
export EMAIL=seu@email.com
export PASSWORD=suasenha
python3 test_campaign_disparo.py
```

### Opção 2: Argumentos de Linha de Comando

```bash
python3 test_campaign_disparo.py seu@email.com suasenha
```

## 📝 O que o Script Faz

1. **Login**: Autentica na API e obtém token JWT
2. **Busca Instâncias**: Lista instâncias de serviço disponíveis
3. **Cria Campanha**: Cria uma nova campanha de teste
4. **Upload CSV**: Faz upload do arquivo `test_campaign.csv`
5. **Inicia Campanha**: Inicia o disparo da campanha
6. **Monitora Status**: Acompanha o progresso (enviadas, falhadas, pendentes)

## 📊 Exemplo de Saída

```
============================================================
🧪 TESTE DE DISPARO DE CAMPANHA
============================================================

📧 Usando email: admin@exemplo.com

🔐 Fazendo login com admin@exemplo.com...
✅ Login realizado com sucesso!

📋 Buscando instâncias de serviço...
✅ Encontradas 1 instância(s):
   - WhatsApp Principal (ID: uuid-123) - Status: Ativa

📢 Criando campanha de teste...
✅ Campanha criada com sucesso! ID: campaign-uuid-456

📤 Fazendo upload do CSV...
✅ Upload realizado! 1 contato(s) adicionado(s)

🚀 Iniciando campanha...
✅ Campanha iniciada! Status: PROCESSING
   Total de contatos: 1
   Pendentes: 1

📊 Monitorando status da campanha...
   Status: PROCESSING | Enviadas: 0 | Falhadas: 0 | Pendentes: 1
   Status: PROCESSING | Enviadas: 1 | Falhadas: 0 | Pendentes: 0

✅ Campanha finalizada! Status: COMPLETED
```

## ⚠️ Observações

- O delay configurado é de 30 segundos (para teste rápido)
- O telefone no CSV será normalizado automaticamente (adiciona `+` se necessário)
- A campanha será criada com o nome: "Teste de Disparo - YYYY-MM-DD HH:MM:SS"
- O script monitora a campanha por até 10 iterações (50 segundos)

## 🔍 Verificar Manualmente

Você também pode verificar o status da campanha via API:

```bash
# Listar campanhas
curl -X GET https://api.elsehub.covenos.com.br/api/campaigns \
  -H "Authorization: Bearer SEU_TOKEN"

# Ver detalhes de uma campanha
curl -X GET https://api.elsehub.covenos.com.br/api/campaigns/CAMPAIGN_ID \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 📱 Telefone de Teste

O CSV contém o telefone: **5514988117592**

O sistema normalizará automaticamente para: **+5514988117592**

---

**Última atualização**: Janeiro 2025

