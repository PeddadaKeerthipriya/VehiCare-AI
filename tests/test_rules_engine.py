"""
Unit tests for the Predictive Maintenance & Compliance Rules Engine.
Uses standard library unittest for zero-dependency execution.
"""

import unittest
import sys
import os
from datetime import date, datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.rules_engine import (
    evaluate_predictive_maintenance,
    parse_date,
    add_months,
    match_component,
    OEM_INTERVALS
)


class TestRulesEngine(unittest.TestCase):

    def test_date_helpers(self):
        # Parsing tests
        self.assertEqual(parse_date("2026-05-15"), date(2026, 5, 15))
        self.assertEqual(parse_date("2026-05-15T14:30:00Z"), date(2026, 5, 15))
        self.assertEqual(parse_date(date(2026, 5, 15)), date(2026, 5, 15))
        self.assertEqual(parse_date(datetime(2026, 5, 15, 12, 0, 0)), date(2026, 5, 15))
        self.assertIsNone(parse_date(None))
        self.assertIsNone(parse_date("invalid-date"))

        # Month addition tests (including leap year / month-end boundaries)
        self.assertEqual(add_months(date(2026, 1, 31), 1), date(2026, 2, 28))
        self.assertEqual(add_months(date(2024, 1, 31), 1), date(2024, 2, 29))  # Leap year
        self.assertEqual(add_months(date(2026, 3, 31), 1), date(2026, 4, 30))
        self.assertEqual(add_months(date(2026, 1, 15), 12), date(2027, 1, 15))

    def test_match_component(self):
        self.assertEqual(match_component("Engine Oil Change", "Mobil1 synthetic"), "oil")
        self.assertEqual(match_component("Tyre Rotation", "4-wheel balance"), "tyre")
        self.assertEqual(match_component("Tire Replacement", ""), "tyre")
        self.assertEqual(match_component("Brake Pad Replacement", "Front discs"), "brake")
        self.assertEqual(match_component("Battery Health Check", "12V Exide"), "battery")
        self.assertEqual(match_component("Air Filter Replacement", "OEM filter"), "air_filter")
        self.assertIsNone(match_component("General Inspection", "Cleaned windshield"))

    def test_maintenance_oil_status_intervals(self):
        ref_date = date(2026, 1, 1)

        # 1. Oil Overdue by Mileage
        vehicle_overdue_km = {
            "id": "v1",
            "odometer_km": 15000,
            "created_at": "2025-01-01"
        }
        records = [{
            "service_type": "Synthetic Oil Change",
            "service_date": "2025-06-01",
            "odometer_km": 4000
        }]
        results = evaluate_predictive_maintenance(
            vehicle=vehicle_overdue_km,
            service_records=records,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertEqual(oil_task["due_odometer_km"], 14000)
        self.assertEqual(oil_task["remaining_km"], -1000)
        self.assertEqual(oil_task["status"], "overdue")

        # 2. Oil Due Soon by Mileage (< 1000 km left)
        vehicle_due_soon_km = {
            "id": "v1",
            "odometer_km": 13500,
            "created_at": "2025-01-01"
        }
        results = evaluate_predictive_maintenance(
            vehicle=vehicle_due_soon_km,
            service_records=records,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertEqual(oil_task["remaining_km"], 500)
        self.assertEqual(oil_task["status"], "due_soon")

        # 3. Oil Overdue by Date
        records_old = [{
            "service_type": "Oil Change",
            "service_date": "2024-11-01",
            "odometer_km": 1000
        }]
        vehicle_low_odo = {
            "id": "v1",
            "odometer_km": 2000,
            "created_at": "2024-11-01"
        }
        results = evaluate_predictive_maintenance(
            vehicle=vehicle_low_odo,
            service_records=records_old,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertTrue(oil_task["remaining_days"] < 0)
        self.assertEqual(oil_task["status"], "overdue")

    def test_custom_interval_overrides(self):
        # 4 days before due date (2026-01-01) -> due_soon
        ref_date = date(2025, 12, 28)
        vehicle = {
            "id": "v-custom",
            "odometer_km": 6500,
            "created_at": "2025-01-01"
        }
        records = [{
            "service_type": "Oil Change",
            "service_date": "2025-07-01",
            "odometer_km": 2000
        }]
        custom_intervals = [{
            "component": "oil",
            "interval_km": 5000,
            "interval_months": 6
        }]
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            service_records=records,
            custom_intervals=custom_intervals,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertEqual(oil_task["due_odometer_km"], 7000)  # 2000 + 5000
        self.assertEqual(oil_task["remaining_km"], 500)      # 7000 - 6500 <= 1000 -> due_soon
        self.assertEqual(oil_task["status"], "due_soon")

    def test_all_five_maintenance_components_evaluated(self):
        ref_date = date(2026, 6, 1)
        vehicle = {
            "id": "v-all",
            "odometer_km": 5000,
            "created_at": "2026-01-01"
        }
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            service_records=[],
            reference_date=ref_date
        )
        components = [r["component"] for r in results if r["category"] == "maintenance"]
        self.assertEqual(sorted(components), sorted(["oil", "tyre", "brake", "battery", "air_filter"]))

    def test_compliance_insurance_checks(self):
        ref_date = date(2026, 9, 1)
        vehicle = {"id": "v1", "odometer_km": 10000}

        # Expired Insurance
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            insurance={"expiry_date": "2026-08-30", "policy_number": "POL-123", "provider": "ICICI"},
            reference_date=ref_date
        )
        ins = next(r for r in results if r["component"] == "insurance")
        self.assertEqual(ins["status"], "overdue")
        self.assertEqual(ins["remaining_days"], -2)

        # Expiring Soon (10 days left <= 15 days)
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            insurance={"expiry_date": "2026-09-11"},
            reference_date=ref_date
        )
        ins = next(r for r in results if r["component"] == "insurance")
        self.assertEqual(ins["status"], "due_soon")
        self.assertEqual(ins["remaining_days"], 10)

        # Safe / Pending (> 15 days left)
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            insurance={"expiry_date": "2026-11-01"},
            reference_date=ref_date
        )
        ins = next(r for r in results if r["component"] == "insurance")
        self.assertEqual(ins["status"], "pending")

    def test_compliance_puc_checks(self):
        ref_date = date(2026, 9, 1)
        vehicle = {"id": "v1", "odometer_km": 10000}

        # Expired PUC
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            puc={"expiry_date": "2026-08-25", "certificate_number": "PUC-999"},
            reference_date=ref_date
        )
        puc_item = next(r for r in results if r["component"] == "puc")
        self.assertEqual(puc_item["status"], "overdue")

        # Due soon (5 days left <= 7 days)
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            puc={"expiry_date": "2026-09-06"},
            reference_date=ref_date
        )
        puc_item = next(r for r in results if r["component"] == "puc")
        self.assertEqual(puc_item["status"], "due_soon")
        self.assertEqual(puc_item["remaining_days"], 5)

    def test_compliance_fastag_checks(self):
        vehicle = {"id": "v1", "odometer_km": 10000}

        # Critical Low Balance <= 100
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            fastag={"balance": 50.0, "low_balance_flag": False}
        )
        ft = next(r for r in results if r["component"] == "fastag")
        self.assertEqual(ft["status"], "overdue")

        # Low balance flag = True
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            fastag={"balance": 300.0, "low_balance_flag": True}
        )
        ft = next(r for r in results if r["component"] == "fastag")
        self.assertEqual(ft["status"], "overdue")

        # Warning Balance (100 < balance <= 250)
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            fastag={"balance": 180.0, "low_balance_flag": False}
        )
        ft = next(r for r in results if r["component"] == "fastag")
        self.assertEqual(ft["status"], "due_soon")

        # Safe Balance (> 250)
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            fastag={"balance": 650.0, "low_balance_flag": False}
        )
        ft = next(r for r in results if r["component"] == "fastag")
        self.assertEqual(ft["status"], "pending")

    def test_edge_cases_and_missing_data(self):
        # Empty vehicle dict
        results = evaluate_predictive_maintenance(vehicle={})
        self.assertEqual(len(results), 5)

        # Multiple records for same component: picks latest
        records = [
            {"service_type": "Oil change", "service_date": "2025-01-01", "odometer_km": 5000},
            {"service_type": "Oil change", "service_date": "2025-07-01", "odometer_km": 11000},
            {"service_type": "Oil change", "service_date": "2024-06-01", "odometer_km": 1000}
        ]
        results = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 12000},
            service_records=records,
            reference_date=date(2025, 8, 1)
        )
    def test_custom_interval_partial_overrides(self):
        ref_date = date(2026, 1, 1)
        vehicle = {"id": "v-partial", "odometer_km": 8000, "created_at": "2025-01-01"}
        records = [{"service_type": "Oil change", "service_date": "2025-01-01", "odometer_km": 0}]

        # 1. km only override -> months should keep OEM default (12 months)
        custom_km_only = [{"component": "oil", "interval_km": 15000}]
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            service_records=records,
            custom_intervals=custom_km_only,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertEqual(oil_task["due_odometer_km"], 15000)
        self.assertEqual(oil_task["due_date"], "2026-01-01")

        # 2. months only override -> km should keep OEM default (10000 km)
        custom_mo_only = [{"component": "oil", "interval_months": 24}]
        results2 = evaluate_predictive_maintenance(
            vehicle=vehicle,
            service_records=records,
            custom_intervals=custom_mo_only,
            reference_date=ref_date
        )
        oil_task2 = next(r for r in results2 if r["component"] == "oil")
        self.assertEqual(oil_task2["due_odometer_km"], 10000)
        self.assertEqual(oil_task2["due_date"], "2027-01-01")

    def test_custom_task_name_and_non_oem_components(self):
        ref_date = date(2026, 6, 1)
        vehicle = {"id": "v-custom-comp", "odometer_km": 25000, "created_at": "2025-01-01"}
        records = [
            {"service_type": "Coolant Flush", "service_date": "2025-06-01", "odometer_km": 10000}
        ]
        custom_intervals = [
            {
                "task_name": "Premium Engine Oil Change",
                "interval_km": 12000,
                "interval_months": 12
            },
            {
                "component": "coolant",
                "task_name": "Coolant Fluid Flush",
                "interval_km": 30000,
                "interval_months": 24
            }
        ]
        results = evaluate_predictive_maintenance(
            vehicle=vehicle,
            service_records=records,
            custom_intervals=custom_intervals,
            reference_date=ref_date
        )
        oil_task = next(r for r in results if r["component"] == "oil")
        self.assertEqual(oil_task["task_name"], "Premium Engine Oil Change")
        self.assertEqual(oil_task["due_odometer_km"], 12000)

        coolant_task = next(r for r in results if r["component"] == "coolant")
        self.assertEqual(coolant_task["task_name"], "Coolant Fluid Flush")
        self.assertEqual(coolant_task["due_odometer_km"], 40000) # 10000 + 30000
        self.assertEqual(coolant_task["remaining_km"], 15000)    # 40000 - 25000
        self.assertEqual(coolant_task["status"], "pending")

    def test_extract_odometer_from_notes(self):
        from app.services.rules_engine import extract_odometer_from_notes

        self.assertEqual(extract_odometer_from_notes("Odometer: 45678 km"), 45678)
        self.assertEqual(extract_odometer_from_notes("Odometer: 45,678 km"), 45678)
        self.assertEqual(extract_odometer_from_notes("Current Mileage: 120,500 km\nOil replaced"), 120500)
        self.assertEqual(extract_odometer_from_notes("odo: 3500"), 3500)
        self.assertIsNone(extract_odometer_from_notes("Regular general service done"))
        self.assertIsNone(extract_odometer_from_notes(None))

    def test_compliance_boundary_checks(self):
        ref_date = date(2026, 9, 1)

        # 1. Insurance Boundary Checks
        # - Expired (overdue)
        # - Expiring in 7 days (due_soon)
        # - Expiring in 30 days (pending)
        ins_expired = {"expiry_date": "2026-08-31", "policy_number": "POL-101", "provider": "HDFC Ergo"}
        ins_due_7 = {"expiry_date": "2026-09-08", "policy_number": "POL-102", "provider": "ICICI Lombard"}
        ins_pending_30 = {"expiry_date": "2026-10-01", "policy_number": "POL-103", "provider": "Bajaj Allianz"}

        res_expired = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            insurance=ins_expired,
            reference_date=ref_date
        )
        ins_task = next(r for r in res_expired if r["component"] == "insurance")
        self.assertEqual(ins_task["status"], "overdue")
        self.assertEqual(ins_task["remaining_days"], -1)

        res_due_7 = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            insurance=ins_due_7,
            reference_date=ref_date
        )
        ins_task_7 = next(r for r in res_due_7 if r["component"] == "insurance")
        self.assertEqual(ins_task_7["status"], "due_soon")
        self.assertEqual(ins_task_7["remaining_days"], 7)

        res_pending_30 = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            insurance=ins_pending_30,
            reference_date=ref_date
        )
        ins_task_30 = next(r for r in res_pending_30 if r["component"] == "insurance")
        self.assertEqual(ins_task_30["status"], "pending")
        self.assertEqual(ins_task_30["remaining_days"], 30)

        # 2. PUC Boundary Checks
        puc_overdue = {"expiry_date": "2026-09-01", "certificate_number": "PUC-001"} # Expiring today = 0 days left = overdue
        puc_due_soon = {"expiry_date": "2026-09-07", "certificate_number": "PUC-002"} # 6 days left = due_soon

        res_puc_od = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            puc=puc_overdue,
            reference_date=ref_date
        )
        puc_task = next(r for r in res_puc_od if r["component"] == "puc")
        self.assertEqual(puc_task["status"], "overdue")
        self.assertEqual(puc_task["remaining_days"], 0)

        res_puc_ds = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            puc=puc_due_soon,
            reference_date=ref_date
        )
        puc_task_ds = next(r for r in res_puc_ds if r["component"] == "puc")
        self.assertEqual(puc_task_ds["status"], "due_soon")

        # 3. FASTag Balance & Date Expiry Checks
        fastag_low_bal = {"balance": 50.0, "tag_id": "FT-123"}
        fastag_date_due = {"balance": 500.0, "last_recharge_date": "2026-09-05", "tag_id": "FT-456"} # 4 days left

        res_ft_bal = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            fastag=fastag_low_bal,
            reference_date=ref_date
        )
        ft_task = next(r for r in res_ft_bal if r["component"] == "fastag")
        self.assertEqual(ft_task["status"], "overdue")

        res_ft_date = evaluate_predictive_maintenance(
            vehicle={"id": "v1", "odometer_km": 1000},
            fastag=fastag_date_due,
            reference_date=ref_date
        )
        ft_task_date = next(r for r in res_ft_date if r["component"] == "fastag")
        self.assertEqual(ft_task_date["status"], "due_soon")
        self.assertEqual(ft_task_date["remaining_days"], 4)

    def test_trigger_predictor_rerun_structure(self):
        import sys
        from unittest.mock import patch, MagicMock

        mock_requests = MagicMock()
        mock_db = MagicMock()

        # Mock vehicle response
        v_resp = MagicMock()
        v_resp.status_code = 200
        v_resp.json.return_value = [{"id": "v-test", "odometer_km": 5000, "created_at": "2025-01-01"}]

        # Mock service records response
        sr_resp = MagicMock()
        sr_resp.status_code = 200
        sr_resp.json.return_value = []

        # Mock custom intervals response
        ci_resp = MagicMock()
        ci_resp.status_code = 200
        ci_resp.json.return_value = []

        # Mock oem intervals response
        oem_resp = MagicMock()
        oem_resp.status_code = 200
        oem_resp.json.return_value = []

        mock_requests.get.side_effect = [v_resp, sr_resp, ci_resp, oem_resp]

        with patch.dict(sys.modules, {"requests": mock_requests, "app.database": mock_db}):
            from app.services.rules_engine import trigger_predictor_rerun
            result = trigger_predictor_rerun("v-test", "sr-123")
            self.assertTrue(result["triggered"])
            self.assertEqual(result["vehicle_id"], "v-test")
            self.assertEqual(result["service_record_id"], "sr-123")
            self.assertEqual(result["schedules_evaluated"], 5)


if __name__ == "__main__":
    unittest.main()

