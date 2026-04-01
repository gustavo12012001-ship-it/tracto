import logging
from typing import Any, Dict, List
from datetime import datetime

class AgronomicEngine:
    """
    Engine deterministico para regras agronomicas da Tracto.
    Calcula riscos e estados com base em regras fisicas antes da IA.
    """

    @staticmethod
    def calculate_spray_window(temp: float, humidity: float, wind_speed: float) -> Dict[str, Any]:
        """
        Calcula se a janela de pulverizacao e segura.
        Regra simplificada:
        - Vento: 5-15 km/h (ideal), < 5 (deriva termica), > 15 (deriva fisica)
        - Umidade: > 50% (ideal)
        - Temperatura: < 30C (ideal)
        """
        score = 100
        reasons = []
        
        # Vento
        if wind_speed > 20:
            score -= 60
            reasons.append("Vento muito forte (>20km/h): alto risco de deriva.")
        elif wind_speed > 15:
            score -= 30
            reasons.append("Vento moderado (>15km/h): atencao a deriva.")
        elif wind_speed < 3:
            score -= 20
            reasons.append("Vento muito calmo (<3km/h): risco de inversao termica.")

        # Umidade
        if humidity < 40:
            score -= 40
            reasons.append("Umidade muito baixa (<40%): gotas evaporam antes de atingir o alvo.")
        elif humidity < 50:
            score -= 15
            reasons.append("Umidade marginal (40-50%).")

        # Temperatura
        if temp > 32:
            score -= 40
            reasons.append("Temperatura muito alta (>32C): risco de fitotoxicidade e evaporacao.")
        elif temp > 30:
            score -= 15
            reasons.append("Temperatura elevada (>30C).")

        status = "safe" if score >= 80 else "caution" if score >= 50 else "unsafe"
        
        return {
            "status": status,
            "color": "green" if status == "safe" else "amber" if status == "caution" else "red",
            "score": max(0, score),
            "reasons": reasons,
            "label": "Seguro" if status == "safe" else "Atencao" if status == "caution" else "Inadequado"
        }

    @staticmethod
    def calculate_frost_risk(temp_min: float, crop_type: str) -> Dict[str, Any]:
        """
        Avalia o risco de geada com base na temperatura minima e sensibilidade da cultura.
        """
        # Thresholds basicos de geada meteorologica (no abrigo) vs relva
        # Se temp no abrigo e < 3C, na relva pode ser < 0C
        
        risk = "none"
        if temp_min <= 0:
            risk = "high"
        elif temp_min <= 3:
            risk = "medium"
        elif temp_min <= 5:
            risk = "low"
            
        # Sensibilidade por cultura (simplificado)
        sensitivity = "medium"
        crops_sensitive = ["Cafe", "Cana-de-açúcar", "Hortaliças", "Citros"]
        crops_hardy = ["Trigo", "Aveia"]
        
        if any(c in (crop_type or "") for c in crops_sensitive):
            sensitivity = "high"
            if risk == "low": risk = "medium"
            if risk == "medium": risk = "high"
        elif any(c in (crop_type or "") for c in crops_hardy):
            sensitivity = "low"
            if risk == "high": risk = "medium"
            if risk == "medium": risk = "low"

        return {
            "risk": risk,
            "color": "red" if risk == "high" else "amber" if risk == "medium" else "white",
            "threshold": temp_min,
            "sensitivity": sensitivity,
            "label": "Alto" if risk == "high" else "Medio" if risk == "medium" else "Baixo" if risk == "low" else "Nenhum"
        }

    @staticmethod
    def calculate_water_stress(precip_sum: float, temp_avg: float, crop_type: str, et0_mm: float | None = None) -> Dict[str, Any]:
        """
        Calcula o balanco hidrico semanal com base em ET0 real (preferencial) ou proxy (fallback).
        """
        used_proxy = False
        if et0_mm is not None:
            # weather_service ja retorna ET0 acumulada na mesma janela da precipitacao (soma 7d)
            weekly_et0 = et0_mm
        else:
            used_proxy = True
            # Proxy baseado em temperatura se ET0 real faltar
            estimated_daily_et0 = (temp_avg * 0.15) + 1.0
            weekly_et0 = estimated_daily_et0 * 7
        
        balance = precip_sum - weekly_et0
        
        if balance < -20:
            status = "critical"
            color = "red"
        elif balance < -10:
            status = "moderate"
            color = "amber"
        else:
            status = "adequate"
            color = "green"
            
        return {
            "status": status,
            "color": color,
            "balance_mm": float(f"{balance:.1f}"),
            "et0_est_mm": float(f"{weekly_et0:.1f}"),
            "precip_mm": precip_sum,
            "used_proxy": used_proxy,
            "label": "Critico" if status == "critical" else "Moderado" if status == "moderate" else "Adequado"
        }

    @staticmethod
    def calculate_confidence(sat_data: bool, weather_data: bool, boundaries_data: bool) -> float:
        """
        Calcula o nivel de confianca da analise (0..1).
        """
        score = 0
        if sat_data: score += 0.4
        if weather_data: score += 0.3
        if boundaries_data: score += 0.3
        
        return round(float(score), 2)
