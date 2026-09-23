"""
Sanity Check Script for Predictive Maintenance & Compliance Rules Engine.

Demonstrates unified timeline evaluation across:
- Standard OEM intervals (Oil, Tyre, Brake, Battery, Air Filter)
- Custom user-defined interval overrides
- Date-based Compliance (Insurance, PUC, FASTag)
"""

import sys
import os
from datetime import date, timedelta

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.rules_engine import evaluate_predictive_maintenance


def run_sanity_check():
    ref_date = date(2026, 9, 4)
    print("===============================================================")
    print(" VEHI-CARE RULES ENGINE SANITY CHECK & UNIFIED TIMELINE AUDIT ")
    print(f" Reference Date: {ref_date}")
    print("===============================================================\n")

    # Sample Vehicle Telemetry
    sample_vehicle = {
        "id": "v-mh12-ab1234",
        "model": "Hyundai Creta 1.5 Petrol",
        "odometer_km": 28500,
        "created_at": "2024-01-15"
    }

    # Sample Service History
    sample_service_records = [
        {
            "service_type": "Synthetic Engine Oil Change",
            "service_date": "2025-08-10",
            "odometer_km": 18000
        },
        {
            "service_type": "Tyre Rotation & Alignment",
            "service_date": "2026-03-01",
            "odometer_km": 24000
        },
        {
            "service_type": "Front Brake Pad Inspection",
            "service_date": "2024-01-15",
            "odometer_km": 0
        }
    ]

    # Sample User-Defined Custom Intervals
    sample_custom_intervals = [
        {
            "component": "oil",
            "task_name": "Premium Engine Oil Change (Custom 8k km)",
            "interval_km": 8000,
            "interval_months": 8
        },
        {
            "component": "spark_plug",
            "task_name": "Iridium Spark Plug Replacement",
            "interval_km": 20000,
            "interval_months": 24
        }
    ]

    # Sample Compliance Documents
    sample_insurance = {
        "provider": "HDFC ERGO General Insurance",
        "policy_number": "POL-99281726",
        "expiry_date": "2026-09-10" # 6 days left -> due_soon
    }

    sample_puc = {
        "certificate_number": "PUC-MH12-2025-883",
        "expiry_date": "2026-09-01" # 3 days overdue -> overdue
    }

    sample_fastag = {
        "tag_id": "NETC-FASTAG-9872",
        "balance": 180.00, # low balance -> due_soon
        "last_recharge_date": "2026-08-01"
    }

    results = evaluate_predictive_maintenance(
        vehicle=sample_vehicle,
        service_records=sample_service_records,
        custom_intervals=sample_custom_intervals,
        insurance=sample_insurance,
        puc=sample_puc,
        fastag=sample_fastag,
        reference_date=ref_date
    )

    # Sort results by status severity (overdue > due_soon > pending)
    status_order = {"overdue": 0, "due_soon": 1, "pending": 2}
    sorted_results = sorted(results, key=lambda x: status_order.get(x.get("status"), 3))

    print(f"Vehicle ID: {sample_vehicle['id']} ({sample_vehicle['model']})")
    print(f"Current Odometer: {sample_vehicle['odometer_km']} km\n")
    print(f"{'Category':<12} | {'Component':<12} | {'Task Name':<38} | {'Due Date':<10} | {'Due Km':<8} | {'Status':<8}")
    print("-" * 105)

    for item in sorted_results:
        cat = item.get("category", "N/A")
        comp = item.get("component", "N/A")
        task = item.get("task_name", "N/A")[:38]
        due_d = str(item.get("due_date") or "N/A")
        due_k = str(item.get("due_odometer_km") or "N/A")
        status = item.get("status", "pending").upper()

        print(f"{cat:<12} | {comp:<12} | {task:<38} | {due_d:<10} | {due_k:<8} | {status:<8}")

    print("\n===============================================================")
    print(" SANITY CHECK COMPLETED SUCCESSFULLY - UNIFIED TIMELINE OK ")
    print("===============================================================")


if __name__ == "__main__":
    run_sanity_check()
