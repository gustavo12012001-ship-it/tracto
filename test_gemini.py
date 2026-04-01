import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("tracto-backend/.env")

gemini_key = os.getenv("GEMINI_API_KEY")
print(f"Key: {gemini_key[:10]}...")

# Example small red image (1x1 pixel) in base64 to test API
small_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

try:
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    prompt = "Relate as cores principais desta imagem em JSON: {\"cores\": []}"
    
    print("Sending to Gemini...")
    result = model.generate_content([
        prompt,
        {"mime_type": "image/png", "data": small_image_base64}
    ])
    
    print(f"Result: {result.text}")
except Exception as e:
    print(f"Error: {e}")
