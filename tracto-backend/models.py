from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model"]
    text: str


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    field_id: str = Field(validation_alias=AliasChoices("field_id", "activeFieldId"))
    messages: list[ChatMessage]
    farm_context: str | None = "Fazenda sem dados especificos no momento."
    image_base64: str | None = None
    image_mime_type: str | None = "image/jpeg"
    hourly_weather: dict | None = None
    satellite_context: dict[str, Any] | None = None
    # Perfil do usuário: 'produtor' | 'pesquisador' | None
    user_profile: str | None = None
    # Contexto de pesquisa (RAG): experimentos, ANOVA, germoplasma serializados
    research_context: str | None = None


class ChatResponse(BaseModel):
    reply: str
    used_field_id: str
    used_field_name: str
    used_variety: str | None = None
    used_area_ha: float | None = None
    used_planting_date: str | None = None
    snapshot_updated_at: str | None = None
    s1_scene_date: str | None = None
    s2_scene_date: str | None = None


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


class SentinelPreloadRequest(BaseModel):
    field_id: str
    source: Literal["s1", "s2"] = "s2"
    mode: str = "truecolor"
    scene_id: str | None = None
    scene_date: str | None = None
    cloud_coverage: float | None = None
    force_refresh: bool = False


class GeoSearchRequest(BaseModel):
    query: str = Field(validation_alias=AliasChoices("query", "q"))


class PlacesSearchRequest(BaseModel):
    query: str
    lat: float
    lng: float
    radius_km: float = 15.0


class PlaceItem(BaseModel):
    id: int
    name: str
    type: str
    address: str | None = None
    lat: float
    lng: float
    distance_km: float
    phone: str | None = None
    website: str | None = None
    opening_hours: str | None = None


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
    field_id: str | None = None
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
    irrigation_type: str | None = Field(default=None, validation_alias=AliasChoices("irrigation_type", "irrigacaoTipo"))
    fertilization_type: str | None = Field(default=None, validation_alias=AliasChoices("fertilization_type", "adubacaoTipo"))
    last_fertilization_date: str | None = Field(default=None, validation_alias=AliasChoices("last_fertilization_date", "ultimaAdubacao"))
    soil_texture: str | None = Field(default=None, validation_alias=AliasChoices("soil_texture", "texturaSolo"))
    previous_crop: str | None = Field(default=None, validation_alias=AliasChoices("previous_crop", "culturaAnterior"))
    crop_rotation: str | None = Field(default=None, validation_alias=AliasChoices("crop_rotation", "rotacaoCulturas"))
    parent_field_id: str | None = None
    field_type: str | None = Field(default="standard")
    treatment_label: str | None = Field(default=None, validation_alias=AliasChoices("treatment_label", "tratamento"))
    block_number: int | None = Field(default=None, validation_alias=AliasChoices("block_number", "blocoNumero"))


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


class FieldLogCreate(BaseModel):
    logged_at: str | None = None  # ISO datetime, default = now() no banco
    operation_type: str
    product: str | None = None
    dose: str | None = None
    area_ha: float | None = None
    cost: float | None = None
    notes: str | None = None


class SeasonCreate(BaseModel):
    name: str
    crop_type: str | None = None
    planting_date: str | None = None
    harvest_date: str | None = None
    area_ha: float | None = None
    productivity_sc_ha: float | None = None
    productivity_kg_ha: float | None = None
    notes: str | None = None


class SeasonUpdate(SeasonCreate):
    pass


class SprayWindowRequest(BaseModel):
    wind_speed: float | None = None
    humidity: float | None = None
    temperature: float | None = None
    rain_next_6h: float | None = None
    rain_next_24h: float | None = None
    weather_code: int | None = None


class AnovaRequest(BaseModel):
    groups: dict[str, list[float]]


class ParcelNdviRequest(BaseModel):
    parcel_boundaries: list[list[float]]
    scene_date: str | None = None


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
    irrigation_type: str | None = None
    fertilization_type: str | None = None
    last_fertilization_date: str | None = None
    soil_texture: str | None = None
    previous_crop: str | None = None
    crop_rotation: str | None = None
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


# ─────────────────────────────────────────────────────────────────────────────
# GERMOPLASMA
# ─────────────────────────────────────────────────────────────────────────────

class GenotypeCreate(BaseModel):
    name: str
    species: str | None = None
    generation: str | None = None          # F1..F8, BC1..BC3, S1..S5, Linhagem Pura
    status: str | None = "Em desenvolvimento"  # Em desenvolvimento|Candidata|Descartada|Registrada
    origin: str | None = None
    female_parent: str | None = None
    male_parent: str | None = None
    year_obtained: int | None = None
    notes: str | None = None
    traits: list[str] | None = None


class GenotypeUpdate(BaseModel):
    name: str | None = None
    species: str | None = None
    generation: str | None = None
    status: str | None = None
    origin: str | None = None
    female_parent: str | None = None
    male_parent: str | None = None
    year_obtained: int | None = None
    notes: str | None = None
    traits: list[str] | None = None


class CrossCreate(BaseModel):
    female_parent: str
    male_parent: str
    date: str | None = None
    f1_name: str | None = None
    purpose: str | None = None
    location: str | None = None
    f1_count: int | None = None
    notes: str | None = None


class BreedingGenerationCreate(BaseModel):
    genotype_id: str
    generation_label: str
    year: int | None = None
    location: str | None = None
    plants_evaluated: int | None = None
    plants_selected: int | None = None
    selection_criteria: str | None = None
    mean_yield: float | None = None
    notes: str | None = None
