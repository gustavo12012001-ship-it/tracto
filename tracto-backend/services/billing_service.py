import os
from datetime import datetime
from supabase import create_client, Client

class BillingService:
    def __init__(self):
        self._supabase: Client | None = None

    @property
    def supabase(self) -> Client:
        if self._supabase is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY")
            if not url or not key:
                raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados.")
            self._supabase = create_client(url, key)
        return self._supabase


    def get_user_plan(self, user_id: str) -> dict:
        result = self.supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
        if not result.data:
            return {"plan_id": "free", "status": "active"}
            
        sub = result.data[0]
        # Active or trialing -> return actual plan
        if sub["status"] in ["active", "trialing"]:
            return {"plan_id": sub["plan_id"], "status": sub["status"]}
            
        return {"plan_id": "free", "status": sub["status"]}

    def get_entitlements(self, user_id: str) -> dict:
        plan = self.get_user_plan(user_id)["plan_id"]
        
        # Free limits
        if plan == "free":
            return {
                "max_fields": 1,
                "can_use_whatsapp": False,
                "can_use_push": False
            }
            
        if plan == "pro":
            return {
                "max_fields": 9999,
                "can_use_whatsapp": True,
                "can_use_push": True
            }
            
        return {"max_fields": 1, "can_use_whatsapp": False, "can_use_push": False}

    def check_field_limit(self, user_id: str) -> bool:
        """Returns True if user CAN create another field - [DESATIVADO TEMPORARIAMENTE]"""
        return True

billing_service = BillingService()
