import os
import requests
from dotenv import load_dotenv

# Carrega do backend .env
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def deduplicate():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontradas no .env")
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    # 0. Debug: Buscar fazendas
    farms_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/farms"
    f_res = requests.get(farms_url, headers=headers)
    print(f"DEBUG: Fazendas encontradas: {len(f_res.json())}")

    # 1. Buscar todos os talhões
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/fields?select=*"
    print(f"Buscando talhões em: {url}")
    
    res = requests.get(url, headers=headers)
    print(f"Status Code: {res.status_code}")
    fields = res.json()
    print(f"Raw Response Length: {len(fields)}")
    
    # (farm_id, name) -> id (manteremos o primeiro encontrado após ordenar por data DESC)
    seen = {} 
    to_delete = []
    
    # Ordenar por created_at decrescente (mais novos primeiro)
    # Alguns podem não ter created_at se forem legados, usamos ID como fallback
    fields.sort(key=lambda x: x.get('created_at') or x.get('id', ''), reverse=True)
    
    for f in fields:
        # Normalizamos o nome para evitar duplicados por espaços
        name_norm = f['name'].strip().lower()
        key = (f['farm_id'], name_norm)
        
        if key in seen:
            to_delete.append(f['id'])
        else:
            seen[key] = f['id']
            
    print(f"Total de talhões: {len(fields)}")
    print(f"Talhões duplicados para remover: {len(to_delete)}")
    
    for fid in to_delete:
        del_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/fields?id=eq.{fid}"
        requests.delete(del_url, headers=headers).raise_for_status()
        print(f"Removido duplicado ID: {fid}")

    print("\n--- Limpeza concluída! ---")

if __name__ == "__main__":
    deduplicate()
