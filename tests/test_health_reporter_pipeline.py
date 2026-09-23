import unittest
from app.prompts.health_reporter_v1 import (
    HEALTH_REPORTER_PROMPT_VERSION,
    build_health_reporter_user_prompt_v1,
    format_health_prompt_context,
)
from app.schemas.health_report import (
    HealthStatusEnum,
    VehicleHealthReportLLMResponse,
    VehicleHealthReportResponseSchema,
)

class TestHealthReporterPipeline(unittest.TestCase):

    def test_format_health_prompt_context_with_timeline(self):
        sample_vehicle = {
            "id": "11111111-1111-1111-1111-111111111111",
            "make": "Toyota",
            "model": "Camry",
            "year": 2020,
            "vin": "4T1B11HK5NW999999",
            "odometer_km": 60000,
            "service_records": [
                {"service_type": "Oil Change", "service_date": "2026-01-10"}
            ],
            "fault_diagnoses": [
                {"symptom": "Brake squeak", "possible_cause": "Worn front pads", "severity": "Warning"}
            ],
            "maintenance_schedules": [
                {"task_name": "Transmission Fluid", "status": "due_soon"}
            ],
            "insurance_policies": [
                {"expiry_date": "2026-12-31"}
            ],
            "puc_certificates": [
                {"expiry_date": "2026-11-15"}
            ],
        }

        context = format_health_prompt_context(sample_vehicle)
        self.assertIn("Toyota", context)
        self.assertIn("Camry", context)
        self.assertIn("60,000 km", context)
        self.assertIn("Transmission Fluid", context)
        self.assertIn("Brake squeak", context)
        self.assertIn("2026-12-31", context)

    def test_build_health_reporter_user_prompt(self):
        prompt = build_health_reporter_user_prompt_v1("Sample Context")
        self.assertIn("--- VEHICLE TIMELINE DATA START ---", prompt)
        self.assertIn("Sample Context", prompt)
        self.assertEqual(HEALTH_REPORTER_PROMPT_VERSION, "v1.0.0")

    def test_vehicle_health_report_schema_validation(self):
        valid_payload = {
            "health_score": 85,
            "status": "Good",
            "summary": "Vehicle is in good operational condition with routine maintenance required soon.",
            "key_concerns": ["Front brake pads nearing replacement"],
            "recommended_actions": ["Inspect brake pads at next service"],
            "confidence_notes": None,
        }

        validated = VehicleHealthReportLLMResponse(**valid_payload)
        self.assertEqual(validated.health_score, 85)
        self.assertEqual(validated.status, HealthStatusEnum.GOOD)
        self.assertEqual(len(validated.key_concerns), 1)

    def test_vehicle_health_report_score_clamping(self):
        # Test score clamping between 0 and 100
        high_score = {
            "health_score": 150,
            "status": "Excellent",
            "summary": "Pristine vehicle condition with no faults.",
        }
        validated = VehicleHealthReportLLMResponse(**high_score)
        self.assertEqual(validated.health_score, 100)

        low_score = {
            "health_score": -20,
            "status": "Critical",
            "summary": "Severe mechanical breakdown detected.",
        }
        validated_low = VehicleHealthReportLLMResponse(**low_score)
        self.assertEqual(validated_low.health_score, 0)


if __name__ == "__main__":
    unittest.main()
