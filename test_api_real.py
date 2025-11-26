#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de teste real da API Elsehu
Testa todos os endpoints com dados reais e documenta os resultados

Uso:
    python3 test_api_real.py

Requisitos:
    pip install requests
"""

import requests
import json
import sys
import os
from datetime import datetime
from typing import Dict, Any, Optional

BASE_URL = "https://api.elsehub.covenos.com.br"
TEST_PHONE = "14988117592"  # Telefone para receber mensagens

# Credenciais do admin (seed)
ADMIN_EMAIL = "admin@elsehu.com"
ADMIN_PASSWORD = "ChangeMe123!"

results = []
access_token = None
refresh_token = None
user_id = None
contact_id = None
conversation_id = None
service_instance_id = None
message_id = None
template_id = None
tabulation_id = None
campaign_id = None


def log_test(name: str, method: str, path: str, status_code: int, 
             request_data: Optional[Dict] = None, response_data: Any = None,
             error: Optional[str] = None):
    """Registra resultado de um teste"""
    result = {
        "name": name,
        "method": method,
        "path": path,
        "status_code": status_code,
        "request": request_data,
        "response": response_data,
        "error": error,
        "timestamp": datetime.now().isoformat()
    }
    results.append(result)
    
    status_emoji = "✅" if status_code < 400 else "❌"
    print(f"{status_emoji} {method} {path} - Status: {status_code}")
    
    if error:
        print(f"   Erro: {error}")
    elif status_code >= 400:
        print(f"   Resposta: {json.dumps(response_data, indent=2, ensure_ascii=False)[:200]}")


def make_request(method: str, path: str, data: Optional[Dict] = None, 
                 files: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
    """Faz uma requisição HTTP"""
    url = f"{BASE_URL}{path}"
    headers = {
        "Content-Type": "application/json"
    }
    
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    
    if files:
        # Para uploads, remover Content-Type para o requests definir automaticamente
        headers.pop("Content-Type", None)
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            if files:
                response = requests.post(url, headers=headers, data=data, files=files, timeout=30)
            else:
                response = requests.post(url, headers=headers, json=data, timeout=30)
        elif method == "PATCH":
            response = requests.patch(url, headers=headers, json=data, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Método HTTP não suportado: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"   Erro de conexão: {str(e)}")
        raise


def test_health_check():
    """Testa o endpoint de health check"""
    print("\n=== TESTANDO HEALTH CHECK ===")
    response = make_request("GET", "/health")
    
    try:
        data = response.json() if response.content else {}
    except:
        data = response.text
    
    log_test("Health Check", "GET", "/health", response.status_code, 
             response_data=data)


def test_auth_login():
    """Testa login e obtém tokens"""
    global access_token, refresh_token, user_id
    
    print("\n=== TESTANDO AUTENTICAÇÃO ===")
    
    # Login
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    response = make_request("POST", "/api/auth/login", data=login_data)
    
    try:
        data = response.json()
        if response.status_code in (200, 201):
            access_token = data.get("tokens", {}).get("accessToken")
            refresh_token = data.get("tokens", {}).get("refreshToken")
            user_id = data.get("user", {}).get("id")
            print(f"   ✅ Login bem-sucedido! User ID: {user_id}")
        else:
            print(f"   ⚠️ Login retornou status inesperado: {response.status_code}")
        log_test("Auth Login", "POST", "/api/auth/login", response.status_code,
                request_data=login_data, response_data=data)
    except:
        log_test("Auth Login", "POST", "/api/auth/login", response.status_code,
                request_data=login_data, response_data=response.text,
                error="Falha ao fazer login")


def test_auth_refresh():
    """Testa refresh token"""
    global access_token, refresh_token
    
    if not refresh_token:
        print("   ⚠️  Pulando refresh - sem refresh token")
        return
    
    refresh_data = {
        "refreshToken": refresh_token
    }
    response = make_request("POST", "/api/auth/refresh", data=refresh_data)
    
    try:
        data = response.json()
        if response.status_code == 200:
            access_token = data.get("tokens", {}).get("accessToken")
            refresh_token = data.get("tokens", {}).get("refreshToken")
        log_test("Auth Refresh", "POST", "/api/auth/refresh", response.status_code,
                request_data=refresh_data, response_data=data)
    except:
        log_test("Auth Refresh", "POST", "/api/auth/refresh", response.status_code,
                request_data=refresh_data, response_data=response.text)


def test_auth_profile():
    """Testa obter perfil"""
    response = make_request("GET", "/api/auth/profile")
    
    try:
        data = response.json()
        log_test("Auth Profile", "GET", "/api/auth/profile", response.status_code,
                response_data=data)
    except:
        log_test("Auth Profile", "GET", "/api/auth/profile", response.status_code,
                response_data=response.text)


def test_users():
    """Testa endpoints de usuários"""
    global user_id
    
    print("\n=== TESTANDO USUÁRIOS ===")
    
    # Listar usuários
    response = make_request("GET", "/api/users", params={"page": 1, "limit": 10})
    try:
        data = response.json()
        log_test("List Users", "GET", "/api/users", response.status_code, response_data=data)
    except:
        log_test("List Users", "GET", "/api/users", response.status_code, response_data=response.text)
    
    # Obter usuário atual
    response = make_request("GET", "/api/users/me")
    try:
        data = response.json()
        if response.status_code == 200 and not user_id:
            user_id = data.get("id")
        log_test("Get User Me", "GET", "/api/users/me", response.status_code, response_data=data)
    except:
        log_test("Get User Me", "GET", "/api/users/me", response.status_code, response_data=response.text)
    
    # Listar operadores online
    response = make_request("GET", "/api/users/online")
    try:
        data = response.json()
        log_test("Get Online Users", "GET", "/api/users/online", response.status_code, response_data=data)
    except:
        log_test("Get Online Users", "GET", "/api/users/online", response.status_code, response_data=response.text)
    
    # Toggle online status
    toggle_data = {"isOnline": True}
    response = make_request("PATCH", "/api/users/me/toggle-online", data=toggle_data)
    try:
        data = response.json()
        log_test("Toggle Online Status", "PATCH", "/api/users/me/toggle-online", 
                response.status_code, request_data=toggle_data, response_data=data)
    except:
        log_test("Toggle Online Status", "PATCH", "/api/users/me/toggle-online",
                response.status_code, request_data=toggle_data, response_data=response.text)


def test_contacts():
    """Testa endpoints de contatos"""
    global contact_id
    
    print("\n=== TESTANDO CONTATOS ===")
    
    # Criar contato
    contact_data = {
        "name": "Teste API Real",
        "phone": f"+55{TEST_PHONE}",
        "cpf": "12345678901",
        "additional1": "Teste de API",
        "additional2": "Documentação real"
    }
    response = make_request("POST", "/api/contacts", data=contact_data)
    try:
        data = response.json()
        if response.status_code == 201:
            contact_id = data.get("id")
            print(f"   ✅ Contato criado! ID: {contact_id}")
        log_test("Create Contact", "POST", "/api/contacts", response.status_code,
                request_data=contact_data, response_data=data)
    except:
        log_test("Create Contact", "POST", "/api/contacts", response.status_code,
                request_data=contact_data, response_data=response.text)
    
    # Listar contatos
    response = make_request("GET", "/api/contacts", params={"page": 1, "limit": 10, "search": "Teste"})
    try:
        data = response.json()
        log_test("List Contacts", "GET", "/api/contacts", response.status_code, response_data=data)
    except:
        log_test("List Contacts", "GET", "/api/contacts", response.status_code, response_data=response.text)
    
    # Obter contato por ID
    if contact_id:
        response = make_request("GET", f"/api/contacts/{contact_id}")
        try:
            data = response.json()
            log_test("Get Contact", "GET", f"/api/contacts/{contact_id}", 
                    response.status_code, response_data=data)
        except:
            log_test("Get Contact", "GET", f"/api/contacts/{contact_id}",
                    response.status_code, response_data=response.text)


def test_service_instances():
    """Testa endpoints de instâncias de serviço"""
    global service_instance_id
    
    print("\n=== TESTANDO INSTÂNCIAS DE SERVIÇO ===")
    
    # Listar instâncias
    response = make_request("GET", "/api/service-instances", params={"includeInactive": "true"})
    try:
        data = response.json()
        if response.status_code == 200 and isinstance(data, list) and len(data) > 0:
            service_instance_id = data[0].get("id")
            print(f"   ✅ Instância encontrada! ID: {service_instance_id}")
        log_test("List Service Instances", "GET", "/api/service-instances", 
                response.status_code, response_data=data)
    except:
        log_test("List Service Instances", "GET", "/api/service-instances",
                response.status_code, response_data=response.text)
    
    # Obter instância por ID
    if service_instance_id:
        response = make_request("GET", f"/api/service-instances/{service_instance_id}")
        try:
            data = response.json()
            log_test("Get Service Instance", "GET", f"/api/service-instances/{service_instance_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Service Instance", "GET", f"/api/service-instances/{service_instance_id}",
                    response.status_code, response_data=response.text)
        
        # Obter QR Code (se Evolution)
        response = make_request("GET", f"/api/service-instances/{service_instance_id}/qrcode")
        try:
            data = response.json()
            log_test("Get QR Code", "GET", f"/api/service-instances/{service_instance_id}/qrcode",
                    response.status_code, response_data={"qrcode": "base64..." if data else None})
        except:
            log_test("Get QR Code", "GET", f"/api/service-instances/{service_instance_id}/qrcode",
                    response.status_code, response_data=response.text)


def test_conversations():
    """Testa endpoints de conversas"""
    global conversation_id, contact_id, service_instance_id
    
    print("\n=== TESTANDO CONVERSAS ===")
    
    if not contact_id or not service_instance_id:
        print("   ⚠️  Pulando conversas - faltam contact_id ou service_instance_id")
        return
    
    # Criar conversa
    conversation_data = {
        "contactId": contact_id,
        "serviceInstanceId": service_instance_id
    }
    response = make_request("POST", "/api/conversations", data=conversation_data)
    try:
        data = response.json()
        if response.status_code == 201:
            conversation_id = data.get("id")
            print(f"   ✅ Conversa criada! ID: {conversation_id}")
        log_test("Create Conversation", "POST", "/api/conversations", response.status_code,
                request_data=conversation_data, response_data=data)
    except:
        log_test("Create Conversation", "POST", "/api/conversations", response.status_code,
                request_data=conversation_data, response_data=response.text)
    
    # Listar conversas
    response = make_request("GET", "/api/conversations", params={"page": 1, "limit": 10, "status": "OPEN"})
    try:
        data = response.json()
        log_test("List Conversations", "GET", "/api/conversations", response.status_code, response_data=data)
    except:
        log_test("List Conversations", "GET", "/api/conversations", response.status_code, response_data=response.text)
    
    # Obter fila
    response = make_request("GET", "/api/conversations/queue")
    try:
        data = response.json()
        log_test("Get Queue", "GET", "/api/conversations/queue", response.status_code, response_data=data)
    except:
        log_test("Get Queue", "GET", "/api/conversations/queue", response.status_code, response_data=response.text)
    
    # Obter conversa por ID
    if conversation_id:
        response = make_request("GET", f"/api/conversations/{conversation_id}")
        try:
            data = response.json()
            log_test("Get Conversation", "GET", f"/api/conversations/{conversation_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Conversation", "GET", f"/api/conversations/{conversation_id}",
                    response.status_code, response_data=response.text)


def test_messages():
    """Testa endpoints de mensagens"""
    global message_id, conversation_id
    
    print("\n=== TESTANDO MENSAGENS ===")
    
    if not conversation_id:
        print("   ⚠️  Pulando mensagens - falta conversation_id")
        return
    
    # Enviar mensagem
    message_data = {
        "conversationId": conversation_id,
        "content": "Olá! Esta é uma mensagem de teste da API real.",
        "via": "CHAT_MANUAL"
    }
    response = make_request("POST", "/api/messages/send", data=message_data)
    try:
        data = response.json()
        if response.status_code == 201:
            message_id = data.get("id")
            print(f"   ✅ Mensagem enviada! ID: {message_id}")
        log_test("Send Message", "POST", "/api/messages/send", response.status_code,
                request_data=message_data, response_data=data)
    except:
        log_test("Send Message", "POST", "/api/messages/send", response.status_code,
                request_data=message_data, response_data=response.text)
    
    # Listar mensagens da conversa
    response = make_request("GET", f"/api/messages/conversation/{conversation_id}", 
                           params={"page": 1, "limit": 50})
    try:
        data = response.json()
        log_test("List Messages", "GET", f"/api/messages/conversation/{conversation_id}",
                response.status_code, response_data=data)
    except:
        log_test("List Messages", "GET", f"/api/messages/conversation/{conversation_id}",
                response.status_code, response_data=response.text)
    
    # Obter mensagem por ID
    if message_id:
        response = make_request("GET", f"/api/messages/{message_id}")
        try:
            data = response.json()
            log_test("Get Message", "GET", f"/api/messages/{message_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Message", "GET", f"/api/messages/{message_id}",
                    response.status_code, response_data=response.text)


def test_templates():
    """Testa endpoints de templates"""
    global template_id, service_instance_id
    
    print("\n=== TESTANDO TEMPLATES ===")
    
    if not service_instance_id:
        print("   ⚠️  Pulando templates - falta service_instance_id")
        return
    
    # Criar template
    template_data = {
        "name": "Template Teste API Real",
        "body": "Olá {{name}}! Este é um template de teste da API real.",
        "serviceInstanceId": service_instance_id,
        "language": "pt_BR",
        "variables": {
            "name": {
                "type": "string",
                "required": True
            }
        }
    }
    response = make_request("POST", "/api/templates", data=template_data)
    try:
        data = response.json()
        if response.status_code == 201:
            template_id = data.get("id")
            print(f"   ✅ Template criado! ID: {template_id}")
        log_test("Create Template", "POST", "/api/templates", response.status_code,
                request_data=template_data, response_data=data)
    except:
        log_test("Create Template", "POST", "/api/templates", response.status_code,
                request_data=template_data, response_data=response.text)
    
    # Listar templates
    response = make_request("GET", "/api/templates", params={"serviceInstanceId": service_instance_id})
    try:
        data = response.json()
        log_test("List Templates", "GET", "/api/templates", response.status_code, response_data=data)
    except:
        log_test("List Templates", "GET", "/api/templates", response.status_code, response_data=response.text)
    
    # Obter template por ID
    if template_id:
        response = make_request("GET", f"/api/templates/{template_id}")
        try:
            data = response.json()
            log_test("Get Template", "GET", f"/api/templates/{template_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Template", "GET", f"/api/templates/{template_id}",
                    response.status_code, response_data=response.text)


def test_tabulations():
    """Testa endpoints de tabulações"""
    global tabulation_id
    
    print("\n=== TESTANDO TABULAÇÕES ===")
    
    # Criar tabulação
    tabulation_data = {
        "name": "Teste API Real"
    }
    response = make_request("POST", "/api/tabulations", data=tabulation_data)
    try:
        data = response.json()
        if response.status_code == 201:
            tabulation_id = data.get("id")
            print(f"   ✅ Tabulação criada! ID: {tabulation_id}")
        log_test("Create Tabulation", "POST", "/api/tabulations", response.status_code,
                request_data=tabulation_data, response_data=data)
    except:
        log_test("Create Tabulation", "POST", "/api/tabulations", response.status_code,
                request_data=tabulation_data, response_data=response.text)
    
    # Listar tabulações
    response = make_request("GET", "/api/tabulations")
    try:
        data = response.json()
        log_test("List Tabulations", "GET", "/api/tabulations", response.status_code, response_data=data)
    except:
        log_test("List Tabulations", "GET", "/api/tabulations", response.status_code, response_data=response.text)
    
    # Obter tabulação por ID
    if tabulation_id:
        response = make_request("GET", f"/api/tabulations/{tabulation_id}")
        try:
            data = response.json()
            log_test("Get Tabulation", "GET", f"/api/tabulations/{tabulation_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Tabulation", "GET", f"/api/tabulations/{tabulation_id}",
                    response.status_code, response_data=response.text)


def test_campaigns():
    """Testa endpoints de campanhas"""
    global campaign_id, service_instance_id, template_id
    
    print("\n=== TESTANDO CAMPANHAS ===")
    
    if not service_instance_id:
        print("   ⚠️  Pulando campanhas - falta service_instance_id")
        return
    
    # Criar campanha
    campaign_data = {
        "name": "Campanha Teste API Real",
        "serviceInstanceId": service_instance_id,
        "delaySeconds": 120
    }
    if template_id:
        campaign_data["templateId"] = template_id
    
    response = make_request("POST", "/api/campaigns", data=campaign_data)
    try:
        data = response.json()
        if response.status_code == 201:
            campaign_id = data.get("id")
            print(f"   ✅ Campanha criada! ID: {campaign_id}")
        log_test("Create Campaign", "POST", "/api/campaigns", response.status_code,
                request_data=campaign_data, response_data=data)
    except:
        log_test("Create Campaign", "POST", "/api/campaigns", response.status_code,
                request_data=campaign_data, response_data=response.text)
    
    # Listar campanhas
    response = make_request("GET", "/api/campaigns")
    try:
        data = response.json()
        log_test("List Campaigns", "GET", "/api/campaigns", response.status_code, response_data=data)
    except:
        log_test("List Campaigns", "GET", "/api/campaigns", response.status_code, response_data=response.text)
    
    # Obter campanha por ID
    if campaign_id:
        response = make_request("GET", f"/api/campaigns/{campaign_id}")
        try:
            data = response.json()
            log_test("Get Campaign", "GET", f"/api/campaigns/{campaign_id}",
                    response.status_code, response_data=data)
        except:
            log_test("Get Campaign", "GET", f"/api/campaigns/{campaign_id}",
                    response.status_code, response_data=response.text)


def test_reports():
    """Testa endpoints de relatórios"""
    print("\n=== TESTANDO RELATÓRIOS ===")
    
    # Conversas finalizadas
    params = {
        "startDate": "2025-01-01T00:00:00.000Z",
        "endDate": datetime.now().isoformat() + "Z"
    }
    response = make_request("GET", "/api/reports/finished-conversations", params=params)
    try:
        data = response.json()
        log_test("Finished Conversations", "GET", "/api/reports/finished-conversations",
                response.status_code, response_data=data)
    except:
        log_test("Finished Conversations", "GET", "/api/reports/finished-conversations",
                response.status_code, response_data=response.text)
    
    # Estatísticas
    response = make_request("GET", "/api/reports/statistics", params=params)
    try:
        data = response.json()
        log_test("Statistics", "GET", "/api/reports/statistics", response.status_code, response_data=data)
    except:
        log_test("Statistics", "GET", "/api/reports/statistics", response.status_code, response_data=response.text)
    
    # Performance de operadores
    response = make_request("GET", "/api/reports/operator-performance", params=params)
    try:
        data = response.json()
        log_test("Operator Performance", "GET", "/api/reports/operator-performance",
                response.status_code, response_data=data)
    except:
        log_test("Operator Performance", "GET", "/api/reports/operator-performance",
                response.status_code, response_data=response.text)


def test_webhooks():
    """Testa endpoints de webhooks"""
    print("\n=== TESTANDO WEBHOOKS ===")
    
    # Verificação Meta
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": "elsehu_verify_token",
        "hub.challenge": "123456"
    }
    response = make_request("GET", "/api/webhooks/meta", params=params)
    log_test("Webhook Meta Verify", "GET", "/api/webhooks/meta", response.status_code,
            response_data=response.text[:200])
    
    # Webhook Meta
    webhook_data = {
        "object": "whatsapp_business_account",
        "entry": []
    }
    response = make_request("POST", "/api/webhooks/meta", data=webhook_data)
    try:
        data = response.json()
        log_test("Webhook Meta", "POST", "/api/webhooks/meta", response.status_code,
                request_data=webhook_data, response_data=data)
    except:
        log_test("Webhook Meta", "POST", "/api/webhooks/meta", response.status_code,
                request_data=webhook_data, response_data=response.text)
    
    # Webhook Evolution
    evolution_data = {
        "event": "messages.upsert",
        "instance": "test",
        "data": {
            "key": {
                "remoteJid": f"{TEST_PHONE}@s.whatsapp.net",
                "fromMe": False,
                "id": "TEST123"
            },
            "message": {
                "conversation": "Mensagem de teste da API real"
            },
            "pushName": "Teste API"
        }
    }
    response = make_request("POST", "/api/webhooks/evolution", data=evolution_data)
    try:
        data = response.json()
        log_test("Webhook Evolution", "POST", "/api/webhooks/evolution", response.status_code,
                request_data=evolution_data, response_data=data)
    except:
        log_test("Webhook Evolution", "POST", "/api/webhooks/evolution", response.status_code,
                request_data=evolution_data, response_data=response.text)


def generate_documentation():
    """Gera documentação com resultados reais"""
    doc = f"""# Documentação de Testes Reais da API - Elsehu Backend

**Base URL**: {BASE_URL}  
**Data dos Testes**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Telefone de Teste**: +55{TEST_PHONE}

Esta documentação contém os resultados **REAIS** dos testes de todos os endpoints da API.

---

## Resumo dos Testes

- **Total de Endpoints Testados**: {len(results)}
- **Endpoints com Sucesso (2xx)**: {len([r for r in results if r['status_code'] < 300])}
- **Endpoints com Erro (4xx/5xx)**: {len([r for r in results if r['status_code'] >= 400])}
- **Taxa de Sucesso**: {len([r for r in results if r['status_code'] < 400]) / len(results) * 100:.1f}%

---

## IDs Obtidos Durante os Testes

- **User ID**: `{user_id or 'N/A'}`
- **Contact ID**: `{contact_id or 'N/A'}`
- **Service Instance ID**: `{service_instance_id or 'N/A'}`
- **Conversation ID**: `{conversation_id or 'N/A'}`
- **Message ID**: `{message_id or 'N/A'}`
- **Template ID**: `{template_id or 'N/A'}`
- **Tabulation ID**: `{tabulation_id or 'N/A'}`
- **Campaign ID**: `{campaign_id or 'N/A'}`

---

## Resultados Detalhados

"""
    
    for i, result in enumerate(results, 1):
        status_emoji = "✅" if result['status_code'] < 400 else "❌"
        status_text = "Sucesso" if result['status_code'] < 400 else "Erro"
        
        doc += f"""### {i}. {result['name']}

**Endpoint**: `{result['method']} {result['path']}`

**Status**: {status_emoji} {status_text} ({result['status_code']})

**Timestamp**: {result['timestamp']}

"""
        
        if result.get('request'):
            doc += f"""**Request Body**:
```json
{json.dumps(result['request'], indent=2, ensure_ascii=False)}
```

"""
        
        if result.get('error'):
            doc += f"""**Erro**:
```
{result['error']}
```

"""
        else:
            doc += f"""**Response**:
```json
{json.dumps(result['response'], indent=2, ensure_ascii=False)}
```

"""
        
        doc += "---\n\n"
    
    doc += f"""
---

## Análise dos Resultados

### Endpoints por Status

"""
    
    status_counts = {}
    for result in results:
        status = result['status_code']
        if status < 300:
            category = "2xx Success"
        elif status < 400:
            category = "3xx Redirect"
        elif status < 500:
            category = "4xx Client Error"
        else:
            category = "5xx Server Error"
        
        status_counts[category] = status_counts.get(category, 0) + 1
    
    for category, count in sorted(status_counts.items()):
        doc += f"- **{category}**: {count} endpoints\n"
    
    doc += """
---

## Observações

"""
    
    if not access_token:
        doc += "- ⚠️ **CRÍTICO**: Falha ao obter token de autenticação. Testes protegidos não foram executados.\n"
    
    if not service_instance_id:
        doc += "- ⚠️ Nenhuma instância de serviço encontrada. Alguns testes foram pulados.\n"
    
    if not contact_id:
        doc += "- ⚠️ Contato não foi criado. Testes de conversas foram pulados.\n"
    
    doc += f"""
- Telefone usado para testes: `+55{TEST_PHONE}`
- Credenciais usadas: `{ADMIN_EMAIL}` (admin da seed)

---

**Fim da Documentação de Testes Reais**
"""
    
    return doc


def main():
    """Função principal"""
    print("=" * 60)
    print("TESTE REAL DA API ELSEHU")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Telefone de teste: +55{TEST_PHONE}")
    print(f"Email: {ADMIN_EMAIL}")
    print("=" * 60)
    
    try:
        # Testes públicos
        test_health_check()
        
        # Autenticação
        test_auth_login()
        
        if not access_token:
            print("\n❌ ERRO CRÍTICO: Não foi possível obter token de autenticação!")
            print("   Verifique as credenciais e tente novamente.")
            sys.exit(1)
        
        # Testes protegidos
        test_auth_refresh()
        test_auth_profile()
        test_users()
        test_contacts()
        test_service_instances()
        test_conversations()
        test_messages()
        test_templates()
        test_tabulations()
        test_campaigns()
        test_reports()
        test_webhooks()
        
        # Gerar documentação
        print("\n" + "=" * 60)
        print("GERANDO DOCUMENTAÇÃO...")
        print("=" * 60)
        
        doc = generate_documentation()
        
        # Salvar documentação
        filename = f"docs/API_TEST_RESULTS_REAL_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, "w", encoding="utf-8") as f:
            f.write(doc)
        
        print(f"\n✅ Documentação salva em: {filename}")
        print(f"\n📊 Resumo:")
        print(f"   - Total de testes: {len(results)}")
        print(f"   - Sucessos: {len([r for r in results if r['status_code'] < 400])}")
        print(f"   - Erros: {len([r for r in results if r['status_code'] >= 400])}")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Teste interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ ERRO FATAL: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

