import os
import requests
from dotenv import load_dotenv

load_dotenv("tracto-backend/.env")

client_id = os.getenv("SENTINEL_CLIENT_ID")
client_secret = os.getenv("SENTINEL_CLIENT_SECRET")

print(f"ID: {client_id[:10]}...")
print(f"Secret: {client_secret[:5]}...")

try:
    response = requests.post(
        "https://services.sentinel-hub.com/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret
        }
    )
    print(f"Auth Status: {response.status_code}")
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Token: {token[:10]}...")
        
        # Test a simple collection search
        headers = {"Authorization": f"Bearer {token}"}
        # Try to find recent Sentinel-2 L2A data for Uberlandia
        # -18.9113, -48.2622
        payload = {
            "input": {
                "bounds": {
                    "bbox": [-48.27, -18.92, -48.25, -18.90],
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
                },
                "data": [{ "type": "sentinel-2-l2a" }]
            },
            "output": { "width": 512, "height": 512, "responses": [{ "identifier": "default", "format": { "type": "image/png" } }] },
            "evalscript": "//VERSION=3\nfunction setup() { return { input: ['B04','B08','dataMask'], output: { bands: 4 } }; }\nfunction evaluatePixel(s) { return [s.B08, s.B04, 0, s.dataMask]; }"
        }
        res = requests.post("https://services.sentinel-hub.com/api/v1/process", headers=headers, json=payload)
        print(f"Process Status: {res.status_code}")
        if res.status_code != 200:
            print(f"Error: {res.text}")
    else:
        print(f"Auth Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
