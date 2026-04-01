import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logging.info(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
logging.info(f"SUPABASE_SERVICE_KEY length: {len(os.getenv('SUPABASE_SERVICE_KEY') or '')}")

from services.farm_service import ensure_default_farm, save_field

# Create a mock authenticated user and try to hit the DB functions directly
# to validate the pydantic mapping + dict conversion.

logging.basicConfig(level=logging.INFO)

# A fake UID that exists in the dev/testing auth schema or just a valid UUID
TEST_USER_ID = "test-user-validate-123"

def main():
    try:
        logging.info("Ensuring default farm...")
        farm = ensure_default_farm(TEST_USER_ID)
        farm_id = farm["id"]
        logging.info(f"Farm ID: {farm_id}")

        logging.info("Validating frontend payload mapping...")
        
        # This represents what the frontend JSON stringifies and sends to FastAPI
        frontend_payload = {
            "farm_id": farm_id,
            "name": "TESTE SANEAMENTO",
            "crop_type": "Milho",
            "variety": "XPTO 123",
            "planting_date": "2025-10-15",
            "area_ha": 15.6,
            "latitude": -23.123,
            "longitude": -51.123,
            "boundaries": [[-23.1,-51.1], [-23.2,-51.1], [-23.2,-51.2]]
        }

        # Simulating the FastAPI Pydantic parsing:
        from models import FieldCreate
        
        # When FastAPI receives JSON, it instantiates the Pydantic model
        parsed = FieldCreate(**frontend_payload)
        
        # When we send to DB, model_dump is called
        db_payload = parsed.model_dump(exclude_unset=True, by_alias=True)
        
        logging.info(f"Pydantic parsed and dumped payload: {json.dumps(db_payload, indent=2)}")
        
        # Attempt to save to Supabase
        logging.info("Saving to Supabase...")
        result = save_field(TEST_USER_ID, db_payload)
        logging.info(f"Saved successfully! ID: {result.get('id')}")
        
    except Exception as e:
        logging.error(f"Validation failed: {e}")

if __name__ == "__main__":
    main()
