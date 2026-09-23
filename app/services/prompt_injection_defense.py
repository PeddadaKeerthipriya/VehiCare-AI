"""
AI Prompt Injection Resistance & Security Defense Module
Defends free-text symptom inputs and raw OCR text against prompt injections, jailbreaks, and delimiter attacks.
"""

import re
from typing import Dict, Any

# Suspicious Prompt Injection Attack Patterns
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"forget\s+(all\s+)?previous",
    r"system\s+override",
    r"new\s+system\s+prompt",
    r"you\s+are\s+now",
    r"act\s+as\s+a",
    r"jailbreak",
    r"do\s+anything\s+now",
    r"</?user_symptom>",
    r"</?raw_ocr_text>",
    r"</?system>",
    r"print\s+system\s+prompt",
    r"reveal\s+api\s+key",
]


def detect_prompt_injection_threat(text: str) -> Dict[str, Any]:
    """
    Scans raw text for prompt injection keywords and threat patterns.
    """
    if not text or not isinstance(text, str):
        return {"threat_detected": False, "threat_matches": [], "risk_score": 0.0}

    matches = []
    text_lower = text.lower()

    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            matches.append(pattern)

    risk_score = min(1.0, len(matches) * 0.4)
    threat_detected = len(matches) > 0

    return {
        "threat_detected": threat_detected,
        "threat_matches": matches,
        "risk_score": round(risk_score, 2),
    }


def sanitize_and_defend_user_symptom(symptom: str) -> str:
    """
    Sanitizes user symptom input, neutralizes XML delimiter break-out attempts, and wraps in safe tags.
    """
    if not symptom or not isinstance(symptom, str):
        symptom = "Unspecified vehicle issue"

    # Neutralize XML tag breakout attempts
    clean_text = symptom.replace("<", "&lt;").replace(">", "&gt;")
    clean_text = clean_text.strip()

    return f"<user_symptom>\n{clean_text}\n</user_symptom>"


def sanitize_and_defend_ocr_text(raw_ocr_text: str) -> str:
    """
    Sanitizes raw OCR invoice text, neutralizes XML tag breakouts, and wraps in untrusted data tags.
    """
    if not raw_ocr_text or not isinstance(raw_ocr_text, str):
        raw_ocr_text = "No OCR text provided"

    # Neutralize XML tag breakout attempts
    clean_ocr = raw_ocr_text.replace("<", "&lt;").replace(">", "&gt;")
    clean_ocr = clean_ocr.strip()

    return f"<raw_ocr_text>\n{clean_ocr}\n</raw_ocr_text>"
