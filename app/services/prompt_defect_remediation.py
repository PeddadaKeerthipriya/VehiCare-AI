"""
P0/P1 Defect Remediation Module for Prompt & LLM Layer
Cleans raw LLM outputs, strips markdown code fences, fixes JSON syntax anomalies, and enforces safety downgrades.
"""

import json
import re
from typing import Dict, Any, Optional


def clean_and_parse_llm_json(raw_llm_text: str) -> Dict[str, Any]:
    """
    P0 Remediation: Strips markdown code fences (```json ... ```), preamble text, and repairs common LLM JSON syntax issues.
    """
    if not raw_llm_text or not isinstance(raw_llm_text, str):
        raise ValueError("Raw LLM text cannot be empty or non-string")

    text = raw_llm_text.strip()

    # Strip markdown code fences if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if match:
            text = match.group(1).strip()

    # Extract JSON object substring if preamble text exists
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]

    # Replace trailing commas before closing braces/brackets
    text = re.sub(r",\s*([\}\]])", r"\1", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse LLM JSON output: {exc}. Raw: '{text[:100]}...'")


def enforce_p0_p1_prompt_remediation(diagnosis_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    P1 Remediation: Normalizes confidence score types, enforces confidence < 0.6 severity downgrade to 'Advisory',
    and ensures mandatory safety disclaimer is present.
    """
    if not isinstance(diagnosis_dict, dict):
        raise ValueError("Diagnosis payload must be a dictionary")

    remediated = dict(diagnosis_dict)

    # 1. Normalize confidence score
    raw_confidence = remediated.get("confidence_score")
    try:
        confidence = float(raw_confidence) if raw_confidence is not None else 0.5
        confidence = max(0.0, min(1.0, confidence))
    except (ValueError, TypeError):
        confidence = 0.5
    remediated["confidence_score"] = confidence

    # 2. Enforce safety rule: if confidence < 0.6, force Advisory severity
    if confidence < 0.6:
        remediated["severity"] = "Advisory"
        notes = remediated.get("confidence_notes") or ""
        if "low confidence" not in notes.lower():
            remediated["confidence_notes"] = (
                f"Confidence score ({confidence:.2f}) below safety threshold (0.60); severity set to Advisory. " + notes
            ).strip()

    # 3. Ensure mandatory disclaimer is present
    default_disclaimer = (
        "DISCLAIMER: This AI-generated fault diagnosis is an automated assessment based on reported symptoms and vehicle service history. "
        "It does not replace a physical inspection by a certified professional automotive mechanic. Always consult a qualified technician before performing repairs."
    )
    if not remediated.get("mechanic_disclaimer") or len(str(remediated.get("mechanic_disclaimer")).strip()) < 10:
        remediated["mechanic_disclaimer"] = default_disclaimer

    return remediated
