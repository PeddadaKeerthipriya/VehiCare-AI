"""
Retrieval Engine for Vehicle Knowledge Base & History Context
"""

from typing import Any, Dict, List
from app.database import supabase

VEHICLE_KNOWLEDGE_BASE = [
    {
        "id": "KB-BRAKE-001",
        "system": "Brakes",
        "keywords": ["squeak", "squeal", "grinding", "brake pad", "rotor", "vibration", "wobble"],
        "possible_cause": "Worn brake pads or warped brake rotors.",
        "recommended_action": "Inspect front/rear brake pads and rotors. Replace if below 3mm.",
        "severity": "Warning"
    },
    {
        "id": "KB-ENGINE-002",
        "system": "Engine",
        "keywords": ["overheating", "steam", "coolant", "temp high", "radiator"],
        "possible_cause": "Coolant leak, stuck thermostat, or failed water pump.",
        "recommended_action": "Pull over safely immediately. Do not drive while overheating.",
        "severity": "Critical"
    },
    {
        "id": "KB-STEER-003",
        "system": "Steering & Suspension",
        "keywords": ["vibration", "wobble", "pulling", "steering wheel", "alignment"],
        "possible_cause": "Unbalanced tires, misaligned wheels, or worn suspension bushings.",
        "recommended_action": "Perform wheel alignment and balance check.",
        "severity": "Advisory"
    }
]


def retrieve_relevant_knowledge(symptom: str, make: str = "", model: str = "", top_k: int = 3) -> List[Dict[str, Any]]:
    symptom_lower = symptom.lower()
    matches = []
    for entry in VEHICLE_KNOWLEDGE_BASE:
        score = 0
        for kw in entry["keywords"]:
            if kw in symptom_lower:
                score += 1
        if score > 0:
            matches.append((score, entry))
    matches.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in matches[:top_k]]


def format_retrieved_knowledge_context(knowledge_entries: List[Dict[str, Any]]) -> str:
    if not knowledge_entries:
        return "No specific match in knowledge base."
    formatted = []
    for entry in knowledge_entries:
        formatted.append(
            f"- [{entry.get('id')}] System: {entry.get('system')} | "
            f"Cause: {entry.get('possible_cause')} | Action: {entry.get('recommended_action')}"
        )
    return "\n".join(formatted)
