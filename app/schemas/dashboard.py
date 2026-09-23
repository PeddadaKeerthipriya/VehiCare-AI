from typing import Any, Dict, List

from pydantic import BaseModel


class DashboardResponse(BaseModel):
    health_summary: Dict[str, Any]
    vehicles: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]
    timeline_90_days: List[Dict[str, Any]]