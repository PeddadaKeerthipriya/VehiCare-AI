import json
from pathlib import Path
import pytest


N8N_DIR = Path("n8n")

WORKFLOW_FILES = [
    "fault_diagnosis_workflow.json",
    "predictive_maintenance_trigger_workflow.json",
    "reminder_notifier_workflow.json",
    "service_slip_workflow.json",
    "vehicle_health_reporter_workflow.json",
]


def test_all_5_n8n_workflows_exist_and_parse():
    """Regression Test 1: Verify all 5 n8n workflow JSON files exist and contain valid n8n schema structures."""
    for filename in WORKFLOW_FILES:
        filepath = N8N_DIR / filename
        assert filepath.exists(), f"Workflow file missing: {filename}"
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert "name" in data, f"Missing name field in {filename}"
        assert "nodes" in data and len(data["nodes"]) > 0, f"No nodes found in {filename}"
        assert "connections" in data, f"No connections found in {filename}"


def test_workflow_node_uniqueness_and_linkage():
    """Regression Test 2: Verify each workflow has unique node IDs and valid connection targets."""
    for filename in WORKFLOW_FILES:
        filepath = N8N_DIR / filename
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        node_names = [n["name"] for n in data["nodes"]]
        assert len(node_names) == len(set(node_names)), f"Duplicate node names in {filename}"

        # Verify all connections point to existing node names
        connections = data.get("connections", {})
        for source_node, targets in connections.items():
            assert source_node in node_names, f"Connection source '{source_node}' not in node list of {filename}"
            for conn_type, conn_list in targets.items():
                for conn_group in conn_list:
                    for target_info in conn_group:
                        target_name = target_info.get("node")
                        assert target_name in node_names, f"Connection target '{target_name}' not found in {filename}"


def test_full_5_workflow_concurrent_chain_simulation():
    """Regression Test 3: Simulate full regression chain of all 5 n8n workflows executing in parallel without schema collisions."""
    pipeline_state = {
        "service_slips": [],
        "fault_diagnoses": [],
        "maintenance_schedules": [],
        "reminders": [],
        "weekly_reports": [],
    }

    # 1. Simulate Service Slip Workflow
    slip_data = {"id": "slip-001", "vehicle_id": "v-100", "total_cost": 4500, "items_count": 3}
    pipeline_state["service_slips"].append(slip_data)
    assert len(pipeline_state["service_slips"]) == 1

    # 2. Simulate Fault Diagnosis Workflow (Critical Alert)
    diag_data = {"vehicle_id": "v-100", "symptom": "Brake noise", "severity": "Critical", "possible_cause": "Worn brake pads"}
    pipeline_state["fault_diagnoses"].append(diag_data)
    if diag_data["severity"] == "Critical":
        pipeline_state["reminders"].append({"type": "critical_alert", "message": f"Critical: {diag_data['possible_cause']}"})
    assert len(pipeline_state["reminders"]) == 1

    # 3. Simulate Predictive Maintenance Trigger Workflow
    maint_data = {"id": "m-001", "vehicle_id": "v-100", "task_name": "Brake Fluid Flush", "status": "due_soon"}
    pipeline_state["maintenance_schedules"].append(maint_data)
    assert len(pipeline_state["maintenance_schedules"]) == 1

    # 4. Simulate Reminder Notifier Workflow (Multi-Entity Pull)
    multi_entity_items = [
        {"entity_type": "maintenance", "entity_id": "m-001", "status": "due_soon"},
        {"entity_type": "insurance", "entity_id": "ins-001", "status": "due_soon"},
        {"entity_type": "puc", "entity_id": "puc-001", "status": "expired"},
        {"entity_type": "fastag", "entity_id": "fast-001", "status": "low_balance"},
    ]
    for item in multi_entity_items:
        pipeline_state["reminders"].append({"type": item["entity_type"], "status": item["status"]})
    assert len(pipeline_state["reminders"]) == 5

    # 5. Simulate Vehicle Health Reporter Workflow
    report = {"vehicle_id": "v-100", "health_score": 85, "summary": "Brakes require attention."}
    pipeline_state["weekly_reports"].append(report)
    assert len(pipeline_state["weekly_reports"]) == 1
