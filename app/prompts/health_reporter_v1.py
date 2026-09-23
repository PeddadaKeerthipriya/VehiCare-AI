"""
Vehicle Health Reporter Prompt Version 1.0.0
Weekly AI Vehicle Health Summary & 0-100 Score Assessment.
Model Target: Anthropic Claude Haiku (claude-3-haiku-20240307 / anthropic/claude-3-haiku)
"""

from typing import Any, Dict, List, Optional

HEALTH_REPORTER_PROMPT_VERSION = "v1.0.0"
PROMPT_VERSION = HEALTH_REPORTER_PROMPT_VERSION
HEALTH_REPORTER_TEMPERATURE = 0.3
CLAUDE_HEALTH_REPORTER_MODEL_DEFAULT = "claude-3-haiku-20240307"

HEALTH_REPORTER_SYSTEM_PROMPT_V1 = """You are the VehiCare AI Master Vehicle Health Specialist and Fleet Diagnostic Analyst.
Your objective is to evaluate a vehicle's complete operational status, mileage, service history, recent diagnostic faults, and scheduled maintenance to generate an objective Weekly Vehicle Health Report.

RULES & CONSTRAINTS:
1. Compute an objective `health_score` integer strictly between 0 and 100 based on the vehicle's context:
   - 90-100: Excellent condition, up-to-date maintenance, no active faults.
   - 75-89: Good condition, minor routine maintenance due soon.
   - 50-74: Fair condition, overdue service intervals or warning faults recorded.
   - 0-49: Critical condition, immediate mechanical repairs or critical safety faults recorded.
2. Identify 1 to 4 concise `key_concerns` (or an empty list if in pristine condition).
3. Provide 1 to 4 prioritized `recommended_actions` for the owner for the upcoming week.
4. Provide a clear, professional 2-3 sentence `summary`.
5. Return ONLY valid JSON strictly matching the requested JSON Schema. Do NOT include markdown code fences (```json) or conversational preamble.

JSON SCHEMA TO RETURN:
{
  "health_score": integer (0 to 100),
  "status": "Excellent | Good | Fair | Critical",
  "summary": "string",
  "key_concerns": ["string"],
  "recommended_actions": ["string"],
  "confidence_notes": "string or null"
}
"""

SYSTEM_PROMPT_HEALTH_REPORTER_V1 = HEALTH_REPORTER_SYSTEM_PROMPT_V1


def format_health_prompt_context(
    vehicle: Dict[str, Any],
    service_records: Optional[List[Dict[str, Any]]] = None,
    fault_diagnoses: Optional[List[Dict[str, Any]]] = None,
    maintenance_schedules: Optional[List[Dict[str, Any]]] = None,
    insurance_policies: Optional[List[Dict[str, Any]]] = None,
    puc_certificates: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Format vehicle timeline and multi-entity data into structured prompt context.
    """
    services = service_records or vehicle.get("service_records") or []
    diagnoses = fault_diagnoses or vehicle.get("fault_diagnoses") or []
    maintenance = maintenance_schedules or vehicle.get("maintenance_schedules") or []
    insurance = insurance_policies or vehicle.get("insurance_policies") or []
    puc = puc_certificates or vehicle.get("puc_certificates") or []

    overdue_maintenance = [
        m for m in maintenance if m.get("status") in ("overdue", "due_soon")
    ]
    recent_diagnoses = diagnoses[:3]
    recent_services = services[:3]

    overdue_str = (
        ", ".join([f"{m.get('task_name', 'Service')} [{m.get('status', 'due')}]" for m in overdue_maintenance])
        if overdue_maintenance
        else "None (All maintenance up-to-date)"
    )

    diag_str = (
        "; ".join([f"{d.get('symptom', 'Issue')} -> Cause: {d.get('possible_cause', 'N/A')} ({d.get('severity', 'Advisory')})" for d in recent_diagnoses])
        if recent_diagnoses
        else "None (No active or recent diagnostic faults)"
    )

    serv_str = (
        "; ".join([f"{s.get('service_type', 'Service')} on {s.get('service_date') or s.get('created_at', 'recent')}" for s in recent_services])
        if recent_services
        else "None recorded"
    )

    ins_str = (
        f"Active (Expires {insurance[0].get('expiry_date', 'N/A')})"
        if insurance
        else "No active insurance policy on file"
    )

    puc_str = (
        f"Valid (Expires {puc[0].get('expiry_date', 'N/A')})"
        if puc
        else "No PUC certificate on file"
    )

    return f"""Vehicle Profile:
- Make: {vehicle.get('make', 'Unknown')}
- Model: {vehicle.get('model', 'Unknown')}
- Year: {vehicle.get('year', 'Unknown')}
- VIN: {vehicle.get('vin', 'N/A')}
- Odometer: {vehicle.get('odometer_km', 0):,} km

Maintenance Status:
- Overdue / Due-Soon Items ({len(overdue_maintenance)}): {overdue_str}

Diagnostic & Fault History:
- Recent Diagnostic Logs ({len(recent_diagnoses)}): {diag_str}

Recent Service Records:
- Past Service History ({len(recent_services)}): {serv_str}

Regulatory Compliance & Documents:
- Insurance Status: {ins_str}
- Pollution Under Control (PUC): {puc_str}

Evaluate the complete vehicle timeline and return ONLY valid JSON matching the schema."""


def build_health_reporter_user_prompt_v1(prompt_context: str) -> str:
    """
    Constructs the user message for Claude Haiku Health Report generation.
    """
    return f"""Please evaluate the following vehicle timeline data and generate the structured Weekly Vehicle Health Report:

--- VEHICLE TIMELINE DATA START ---
{prompt_context}
--- VEHICLE TIMELINE DATA END ---

Return ONLY valid JSON matching the requested schema."""
