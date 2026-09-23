"""
Google Maps / Places API Key Setup & Quota Cost Guardrails Module
Enforces request limits, budget ceilings, and caching policies for Places API queries.
"""

import os
from typing import Dict, Any, Optional

# Default Quota & Budget Ceilings
DEFAULT_DAILY_REQUEST_LIMIT = 1000  # max requests / day
DEFAULT_DAILY_SPEND_LIMIT_USD = 10.00  # max USD spend / day
COST_PER_NEARBY_SEARCH_REQUEST_USD = 0.032  # Places API Nearby Search pricing per request ($32 / 1,000 requests)


class GoogleMapsGuardrailManager:
    def __init__(
        self,
        daily_request_limit: int = DEFAULT_DAILY_REQUEST_LIMIT,
        daily_spend_limit_usd: float = DEFAULT_DAILY_SPEND_LIMIT_USD
    ):
        self.api_key = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY") or "MOCK_GOOGLE_MAPS_KEY"
        self.daily_request_limit = daily_request_limit
        self.daily_spend_limit_usd = daily_spend_limit_usd
        self.cache: Dict[str, Dict[str, Any]] = {}

    def get_api_key_status(self) -> Dict[str, Any]:
        """
        Checks if Google Maps API key is configured.
        """
        return {
            "configured": bool(self.api_key and not self.api_key.startswith("MOCK_")),
            "api_key_prefix": self.api_key[:6] + "..." if self.api_key else "None",
            "daily_request_limit": self.daily_request_limit,
            "daily_spend_limit_usd": self.daily_spend_limit_usd,
        }

    def evaluate_request_guardrail(
        self,
        current_daily_requests: int,
        current_daily_spend_usd: float
    ) -> Dict[str, Any]:
        """
        Evaluates whether a new Google Places API request is allowed under cost & quota guardrails.
        """
        if current_daily_requests >= self.daily_request_limit:
            return {
                "allowed": False,
                "reason": f"Daily request quota limit reached ({current_daily_requests}/{self.daily_request_limit}).",
                "code": "QUOTA_EXCEEDED"
            }

        if current_daily_spend_usd >= self.daily_spend_limit_usd:
            return {
                "allowed": False,
                "reason": f"Daily spend ceiling exceeded (${current_daily_spend_usd:.2f}/${self.daily_spend_limit_usd:.2f}).",
                "code": "BUDGET_EXCEEDED"
            }

        projected_spend = current_daily_spend_usd + COST_PER_NEARBY_SEARCH_REQUEST_USD
        if projected_spend > self.daily_spend_limit_usd:
            return {
                "allowed": False,
                "reason": f"Projected request cost (${projected_spend:.3f}) exceeds daily spend limit (${self.daily_spend_limit_usd:.2f}).",
                "code": "BUDGET_LIMIT_REACHED"
            }

        return {
            "allowed": True,
            "reason": "Request allowed under quota and cost guardrails.",
            "code": "OK",
            "estimated_cost_usd": COST_PER_NEARBY_SEARCH_REQUEST_USD,
            "projected_total_spend_usd": round(projected_spend, 4),
        }

    def build_cache_key(self, lat: float, lng: float, radius_m: int) -> str:
        """
        Builds a normalized cache key for Google Places nearby service-center queries.
        """
        # Round lat/lng to 3 decimal places (~110 meters) for efficient query caching
        rounded_lat = round(lat, 3)
        rounded_lng = round(lng, 3)
        return f"places_{rounded_lat}_{rounded_lng}_{radius_m}"
