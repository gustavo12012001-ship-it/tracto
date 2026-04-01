import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

print(f"Checking Supabase project: {url}")

# Check root to see schema
try:
    response = requests.get(f"{url.rstrip('/')}/rest/v1/", headers=headers)
    if response.status_code == 200:
        data = response.json()
        definitions = data.get("definitions", {})
        print("\nAvailable tables/definitions:")
        for table in definitions.keys():
            print(f"- {table}")
    else:
        print(f"Error checking schema: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception checking schema: {e}")

# Check specific tables
tables = ["conversations", "farms", "fields", "subscriptions", "whatsapp_contacts", "push_subscriptions"]
print("\nChecking specific tables:")
for table in tables:
    try:
        r = requests.get(f"{url.rstrip('/')}/rest/v1/{table}?limit=1", headers=headers)
        print(f"Table '{table}': {r.status_code}")
        if r.status_code != 200:
            print(f"  Detail: {r.text}")
    except Exception as e:
        print(f"  Exception checking '{table}': {e}")
