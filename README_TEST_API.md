# Script de Teste Real da API

Este script Python testa **TODOS** os endpoints da API Elsehu com dados reais e gera uma documentação completa com os resultados.

## Requisitos

```bash
pip install requests
```

## Executar

```bash
python3 test_api_real.py
```

## O que o script faz

1. **Faz login** com as credenciais do admin (seed)
2. **Testa todos os endpoints** sequencialmente:
   - Health Check
   - Autenticação (login, refresh, profile)
   - Usuários (CRUD completo)
   - Contatos (CRUD + importação)
   - Instâncias de Serviço (listagem, detalhes, QR Code)
   - Conversas (CRUD + atribuição + fechamento)
   - Mensagens (envio + listagem)
   - Templates (CRUD)
   - Tabulações (CRUD)
   - Campanhas (CRUD + controle)
   - Relatórios (todos os endpoints)
   - Webhooks (Meta + Evolution)

3. **Usa dados reais**:
   - Telefone: `+5514988117592` (para receber mensagens)
   - IDs reais obtidos durante os testes
   - Instância existente no sistema

4. **Gera documentação** em `docs/API_TEST_RESULTS_REAL_YYYYMMDD_HHMMSS.md` com:
   - Todos os requests e responses reais
   - Status codes
   - Erros encontrados
   - IDs obtidos
   - Análise dos resultados

## Configuração

O script usa as seguintes configurações (podem ser alteradas no código):

- **Base URL**: `https://api.elsehub.covenos.com.br`
- **Email**: `admin@elsehu.com` (admin da seed)
- **Senha**: `admin123` (senha da seed)
- **Telefone**: `14988117592` (para receber mensagens)

## Saída

O script imprime o progresso no console e gera um arquivo Markdown com todos os resultados reais.

