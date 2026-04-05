from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    farm_context: str | None = "Fazenda sem dados especificos no momento."
    image_base64: str | None = None
    image_mime_type: str | None = "image/jpeg"
    hourly_weather: dict | None = None


class AlertRequest(BaseModel):
    temperature: float
    humidity: float
    rain_accumulation: float
    wind_speed: float
    et0: float | None = None
    crop_type: str | None = None
    fields: list[dict]
    weather_forecast: str | None = None


class FieldAnalysisRequest(BaseModel):
    field_id: str | None = None
    field_name: str
    lat: float
    lng: float
    boundaries: list[list[float]] | None = None
    crop_type: str | None = None
    planting_date: str | None = None
    variety: str | None = None
    area_ha: float | None = None
    date_range_days: int = 21
    hourly_weather: dict | None = None
    forecast_7d: str | None = None


class LatestSceneRequest(BaseModel):
    lat: float
    lng: float
    boundaries: list[list[float]] | None = None
    lookback_days: int = 21
    max_cloud_coverage: int = 40


class GeoSearchRequest(BaseModel):
    q: str


class FieldAnalysisResponse(BaseModel):
    field_name: str
    ndvi_image_base64: str | None
    date_acquired: str | None
    cloud_coverage: float | None
    ndvi_analysis: dict[str, Any]
    weather_summary: str
    ai_report: str
    alerts: list[dict[str, Any]]
    cached: bool
    is_mock: bool = False
    analyzed_at: str
    confidence: float | None = None
    engine_results: dict[str, Any] | None = None
    source: str | None = None


class SaveConversationRequest(BaseModel):
    conversation_id: str
    title: str
    messages: list[ChatMessage]
    farm_context: str | None = None
    created_at: str
    updated_at: str


class RecaptchaRequest(BaseModel):
    token: str


class FarmBase(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False


class FarmCreate(FarmBase):
    pass


class FarmUpdate(FarmBase):
    id: str


class FieldBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    farm_id: str
    name: str
    crop_type: str | None = Field(default=None, validation_alias=AliasChoices("crop_type", "cultura"))
    variety: str | None = Field(default=None, validation_alias=AliasChoices("variety", "variedade"))
    planting_date: str | None = Field(default=None, validation_alias=AliasChoices("planting_date", "dataPlantio"))
    area_ha: float | None = Field(default=None, validation_alias=AliasChoices("area_ha", "areaHa"))
    boundaries: Any | None = None
    latitude: float = Field(validation_alias=AliasChoices("latitude", "lat"))
    longitude: float = Field(validation_alias=AliasChoices("longitude", "lng"))


class FieldCreate(FieldBase):
    pass


class FieldUpdate(FieldBase):
    id: str


class CheckoutRequest(BaseModel):
    plan_id: str
    payment_method: str = "credit_card"


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class WhatsAppWebhookPayload(BaseModel):
    From: str
    Body: str
    ProfileName: str | None = None


class SnapshotSourceStatus(BaseModel):
    status: Literal["ok", "fallback", "unavailable"]
    message: str
    updated_at: str | None = None


class FieldIntelligenceSnapshot(BaseModel):
    field_id: str
    field_name: str
    farm_id: str | None = None
    farm_name: str | None = None
    lat: float
    lng: float
    boundaries: list[list[float]] | None = None
    crop_type: str | None = None
    planting_date: str | None = None
    variety: str | None = None
    area_ha: float | None = None
    weather: dict[str, Any]
    satellite: dict[str, Any]
    analysis: dict[str, Any]
    alerts: list[dict[str, Any]]
    report_summary: str
    weather_status: SnapshotSourceStatus
    satellite_status: SnapshotSourceStatus
    analysis_status: SnapshotSourceStatus
    ai_summary_status: SnapshotSourceStatus
    updated_at: str
