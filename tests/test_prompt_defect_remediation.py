import pytest
from app.services.prompt_defect_remediation import (
    clean_and_parse_llm_json,
    enforce_p0_p1_prompt_remediation,
)


def test_clean_and_parse_llm_json_markdown_fences():
    raw_llm = """Here is the extracted JSON output:
```json
{
  "severity": "Warning",
  "possible_cause": "Low engine oil level",
  "recommended_action": "Check dipstick and top up oil",
  "confidence_score": 0.85,
  "mechanic_required": false
}
```"""
    parsed = clean_and_parse_llm_json(raw_llm)
    assert parsed["severity"] == "Warning"
    assert parsed["confidence_score"] == 0.85


def test_clean_and_parse_llm_json_trailing_comma_repair():
    raw_llm = """{
  "severity": "Critical",
  "possible_cause": "Brake line leak",
  "confidence_score": 0.92,
}"""
    parsed = clean_and_parse_llm_json(raw_llm)
    assert parsed["severity"] == "Critical"
    assert parsed["confidence_score"] == 0.92


def test_enforce_p0_p1_low_confidence_downgrade():
    raw_diagnosis = {
        "severity": "Critical",
        "possible_cause": "Unclear rattling noise",
        "confidence_score": 0.45,  # Low confidence < 0.6
        "mechanic_required": True,
    }
    remediated = enforce_p0_p1_prompt_remediation(raw_diagnosis)
    assert remediated["severity"] == "Advisory"
    assert remediated["confidence_score"] == 0.45
    assert "safety threshold" in remediated["confidence_notes"].lower()


def test_enforce_p0_p1_missing_disclaimer_remediation():
    raw_diagnosis = {
        "severity": "Warning",
        "possible_cause": "Alternator belt slip",
        "confidence_score": 0.88,
        "mechanic_required": True,
        "mechanic_disclaimer": "",
    }
    remediated = enforce_p0_p1_prompt_remediation(raw_diagnosis)
    assert "DISCLAIMER" in remediated["mechanic_disclaimer"]
