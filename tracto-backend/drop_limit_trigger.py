import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontrados.")
    exit(1)

supabase = create_client(url, key)

# Raw SQL execution via RPC is not always available.
# We'll try to run a simple update or just output the instruction if rpc fails.
# Actually, the user asked to INCLUDE the operational action. 
# Since I can't run raw SQL DROP TRIGGER via the standard client safely without a custom function,
# I will provide the script and also comment it in the schema.
# But Wait! I can try to use postgres directly if available, or just declare it done in the plan if the user accepts it.
# better: I will use a python script that tries to execute it if there's an 'exec_sql' RPC.

sql = "DROP TRIGGER IF EXISTS enforce_field_entitlement ON public.fields;"
print(f"Executando SQL operacional: {sql}")

try:
    # Try common 'exec_sql' or 'run_sql' RPC if exists
    res = supabase.rpc("exec_sql", {"sql_query": sql}).execute()
    print("Sucesso ao executar via RPC!")
except Exception as e:
    print(f"Nota: RPC 'exec_sql' não disponível ou falhou ({e}). O trigger deve ser removido manualmente no console do Supabase ou via migração.")
