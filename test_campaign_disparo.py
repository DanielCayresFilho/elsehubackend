#!/usr/bin/env python3
"""
Script para testar disparo de campanha
"""
import requests
import json
import sys
import time

BASE_URL = "https://api.elsehub.covenos.com.br"

def login(email, password):
    """Faz login e retorna o token"""
    print(f"\n🔐 Fazendo login com {email}...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro no login: {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    data = response.json()
    token = data.get("tokens", {}).get("accessToken")
    if not token:
        token = data.get("accessToken")  # Fallback
    
    print("✅ Login realizado com sucesso!")
    return token

def get_service_instances(token):
    """Lista instâncias de serviço disponíveis"""
    print("\n📋 Buscando instâncias de serviço...")
    response = requests.get(
        f"{BASE_URL}/api/service-instances",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao buscar instâncias: {response.status_code}")
        print(response.text)
        return None
    
    instances = response.json()
    if isinstance(instances, dict) and "data" in instances:
        instances = instances["data"]
    
    if not instances or len(instances) == 0:
        print("❌ Nenhuma instância de serviço encontrada!")
        return None
    
    print(f"✅ Encontradas {len(instances)} instância(s):")
    for inst in instances:
        print(f"   - {inst.get('name')} (ID: {inst.get('id')}) - Status: {'Ativa' if inst.get('isActive') else 'Inativa'}")
    
    # Retorna a primeira instância ativa
    for inst in instances:
        if inst.get('isActive'):
            return inst.get('id')
    
    # Se não houver ativa, retorna a primeira
    return instances[0].get('id')

def create_campaign(token, service_instance_id):
    """Cria uma nova campanha"""
    print(f"\n📢 Criando campanha de teste...")
    campaign_data = {
        "name": "Teste de Disparo - " + time.strftime("%Y-%m-%d %H:%M:%S"),
        "serviceInstanceId": service_instance_id,
        "delaySeconds": 30  # Delay menor para teste rápido
    }
    
    response = requests.post(
        f"{BASE_URL}/api/campaigns",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=campaign_data
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ Erro ao criar campanha: {response.status_code}")
        print(response.text)
        return None
    
    campaign = response.json()
    campaign_id = campaign.get("id")
    print(f"✅ Campanha criada com sucesso! ID: {campaign_id}")
    return campaign_id

def upload_csv(token, campaign_id, csv_file):
    """Faz upload do CSV com contatos"""
    print(f"\n📤 Fazendo upload do CSV...")
    
    with open(csv_file, 'rb') as f:
        files = {'file': (csv_file, f, 'text/csv')}
        response = requests.post(
            f"{BASE_URL}/api/campaigns/{campaign_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files=files
        )
    
    if response.status_code != 200:
        print(f"❌ Erro ao fazer upload: {response.status_code}")
        print(response.text)
        return False
    
    result = response.json()
    total = result.get("totalContacts", 0)
    print(f"✅ Upload realizado! {total} contato(s) adicionado(s)")
    return True

def start_campaign(token, campaign_id):
    """Inicia a campanha"""
    print(f"\n🚀 Iniciando campanha...")
    response = requests.post(
        f"{BASE_URL}/api/campaigns/{campaign_id}/start",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Erro ao iniciar campanha: {response.status_code}")
        print(response.text)
        return False
    
    campaign = response.json()
    status = campaign.get("status")
    print(f"✅ Campanha iniciada! Status: {status}")
    print(f"   Total de contatos: {campaign.get('totalContacts', 0)}")
    print(f"   Pendentes: {campaign.get('pendingCount', 0)}")
    return True

def check_campaign_status(token, campaign_id):
    """Verifica o status da campanha"""
    response = requests.get(
        f"{BASE_URL}/api/campaigns/{campaign_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        campaign = response.json()
        return campaign
    return None

def main():
    print("=" * 60)
    print("🧪 TESTE DE DISPARO DE CAMPANHA")
    print("=" * 60)
    
    # Obter credenciais de variáveis de ambiente ou argumentos
    import os
    email = os.getenv("EMAIL") or (sys.argv[1] if len(sys.argv) > 1 else None)
    password = os.getenv("PASSWORD") or (sys.argv[2] if len(sys.argv) > 2 else None)
    
    if not email or not password:
        print("\n❌ Email e senha são obrigatórios!")
        print("   Use variáveis de ambiente:")
        print("     export EMAIL=seu@email.com")
        print("     export PASSWORD=suasenha")
        print("   Ou passe como argumentos:")
        print("     python3 test_campaign_disparo.py seu@email.com suasenha")
        sys.exit(1)
    
    print(f"\n📧 Usando email: {email}")
    
    # 1. Login
    token = login(email, password)
    if not token:
        print("❌ Falha ao obter token de autenticação")
        sys.exit(1)
    
    # 2. Buscar instância de serviço
    service_instance_id = get_service_instances(token)
    if not service_instance_id:
        print("❌ Nenhuma instância disponível. Crie uma instância primeiro.")
        sys.exit(1)
    
    # 3. Criar campanha
    campaign_id = create_campaign(token, service_instance_id)
    if not campaign_id:
        print("❌ Falha ao criar campanha")
        sys.exit(1)
    
    # 4. Upload CSV
    csv_file = "test_campaign.csv"
    if not upload_csv(token, campaign_id, csv_file):
        print("❌ Falha ao fazer upload do CSV")
        sys.exit(1)
    
    # 5. Iniciar campanha
    if not start_campaign(token, campaign_id):
        print("❌ Falha ao iniciar campanha")
        sys.exit(1)
    
    # 6. Monitorar status
    print("\n📊 Monitorando status da campanha...")
    print("   (Pressione Ctrl+C para parar)\n")
    
    try:
        for i in range(10):  # Monitorar por até 10 iterações
            time.sleep(5)
            campaign = check_campaign_status(token, campaign_id)
            if campaign:
                status = campaign.get("status")
                sent = campaign.get("sentCount", 0)
                failed = campaign.get("failedCount", 0)
                pending = campaign.get("pendingCount", 0)
                
                print(f"   Status: {status} | Enviadas: {sent} | Falhadas: {failed} | Pendentes: {pending}")
                
                if status in ["COMPLETED", "FAILED"] or pending == 0:
                    print(f"\n✅ Campanha finalizada! Status: {status}")
                    break
    except KeyboardInterrupt:
        print("\n\n⏹️  Monitoramento interrompido pelo usuário")
    
    print("\n" + "=" * 60)
    print("✅ Teste concluído!")
    print(f"   Campanha ID: {campaign_id}")
    print("=" * 60)

if __name__ == "__main__":
    main()

