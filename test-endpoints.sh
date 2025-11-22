#!/bin/bash

BASE_URL="https://api.elsehub.covenos.com.br/api"
EMAIL="admin@elsehu.com"
PASSWORD="ChangeMe123!"

echo "🔐 Fazendo login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.tokens.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Erro ao fazer login"
  echo "$LOGIN_RESPONSE" | jq .
  exit 1
fi

echo "✅ Login realizado com sucesso"
echo ""

# Função para testar endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo "🧪 Testando: $description"
  echo "   $method $endpoint"
  
  if [ "$method" == "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "   ✅ Sucesso ($HTTP_CODE)"
    echo "$BODY" | jq . | head -10
  else
    echo "   ❌ Erro ($HTTP_CODE)"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  fi
  echo ""
}

# Testes
echo "📋 TESTANDO ENDPOINTS"
echo "===================="
echo ""

# 1. Listar usuários
test_endpoint "GET" "/users" "" "Listar usuários"

# 2. Criar usuário
test_endpoint "POST" "/users" '{
  "name": "Teste Operador",
  "email": "teste@exemplo.com",
  "password": "senha123456",
  "role": "OPERATOR",
  "isActive": true
}' "Criar usuário"

# 3. Criar contato
test_endpoint "POST" "/contacts" '{
  "name": "João Silva",
  "phone": "+5511999999999",
  "cpf": "12345678901"
}' "Criar contato"

# 4. Criar tabulação
test_endpoint "POST" "/tabulations" '{
  "name": "Acordo Gerado"
}' "Criar tabulação"

# 5. Criar instância de serviço
test_endpoint "POST" "/service-instances" '{
  "name": "Instância Teste",
  "provider": "OFFICIAL_META",
  "credentials": {
    "token": "test-token",
    "phoneId": "test-phone-id"
  }
}' "Criar instância de serviço"

# 6. Listar instâncias (para pegar ID)
echo "🧪 Obtendo lista de instâncias..."
INSTANCES_RESPONSE=$(curl -s -X GET "$BASE_URL/service-instances" \
  -H "Authorization: Bearer $TOKEN")
INSTANCE_ID=$(echo "$INSTANCES_RESPONSE" | jq -r '.[0].id // empty')

if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "null" ]; then
  echo "✅ Instância encontrada: $INSTANCE_ID"
  echo ""
  
  # 7. Criar template
  test_endpoint "POST" "/templates" "{
    \"name\": \"Template Teste\",
    \"body\": \"Olá {{name}}, bem-vindo!\",
    \"serviceInstanceId\": \"$INSTANCE_ID\",
    \"language\": \"pt_BR\"
  }" "Criar template"
  
  # 8. Criar campanha
  test_endpoint "POST" "/campaigns" "{
    \"name\": \"Campanha Teste\",
    \"serviceInstanceId\": \"$INSTANCE_ID\",
    \"delaySeconds\": 120
  }" "Criar campanha"
else
  echo "⚠️  Nenhuma instância encontrada, pulando testes de template e campanha"
  echo ""
fi

# 9. Listar contatos
test_endpoint "GET" "/contacts" "" "Listar contatos"

# 10. Listar tabulações
test_endpoint "GET" "/tabulations" "" "Listar tabulações"

# 11. Estatísticas
test_endpoint "GET" "/reports/statistics" "" "Obter estatísticas"

echo "✅ Testes concluídos!"

