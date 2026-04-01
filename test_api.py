import requests
import json

url = "http://127.0.0.1:8000/api/analyze-field"
payload = {
  "lat": -18.9113,
  "lng": -48.2622,
  "field_name": "Talhão Teste",
  "crop_type": "Soja",
  "date_range_days": 15
}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    result = response.json()
    # Mask base64 for cleaner output
    if result.get("ndvi_image_base64"):
        result["ndvi_image_base64"] = result["ndvi_image_base64"][:50] + "..."
    print(json.dumps(result, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Erro: {e}")
