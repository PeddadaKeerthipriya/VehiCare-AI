import json
import unittest
from pathlib import Path
class TestN8nWorkflows(unittest.TestCase):
    def test_vehicle_health_reporter_workflow_json_validity(self):
        workflow_path = Path("n8n/vehicle_health_reporter_workflow.json")
        self.assertTrue(workflow_path.exists(), "n8n/vehicle_health_reporter_workflow.json does not exist")
        with open(workflow_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("nodes", data)
        self.assertIn("connections", data)
        node_names = {node["name"] for node in data["nodes"]}
        expected_nodes = {
            "Weekly Cron Trigger",
            "Fetch Vehicles & Health Data",
            "Format Health Prompt Context",
            "Generate LLM Health Summary",
            "Queue Weekly Report Notification",
        }
        self.assertTrue(expected_nodes.issubset(node_names))
        # Verify Notification Queue Node integration
        notif_node = next(n for n in data["nodes"] if n["name"] == "Queue Weekly Report Notification")
        self.assertIn("notifications", notif_node["parameters"]["url"].lower())
    def test_reminder_notifier_multi_entity_workflow_json_validity(self):
        workflow_path = Path("n8n/reminder_notifier_workflow.json")
        self.assertTrue(workflow_path.exists(), "n8n/reminder_notifier_workflow.json does not exist")
        with open(workflow_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("nodes", data)
        self.assertIn("connections", data)
        node_names = {node["name"] for node in data["nodes"]}
        expected_nodes = {
            "Daily Cron Trigger",
            "Fetch Due Services",
            "Fetch Insurance Expiries",
            "Fetch PUC Expiries",
            "Fetch FASTag Accounts",
            "Aggregate Multi-Entity Alerts",
            "Deduplicate Alerts",
            "Queue Reminders",
        }
        self.assertTrue(expected_nodes.issubset(node_names))
        # Verify Notification Queue Node integration
        notif_node = next(n for n in data["nodes"] if n["name"] == "Queue Reminders")
        self.assertIn("notifications", notif_node["parameters"]["url"].lower())
    def test_fault_diagnosis_critical_alert_wiring(self):
        workflow_path = Path("n8n/fault_diagnosis_workflow.json")
        self.assertTrue(workflow_path.exists(), "n8n/fault_diagnosis_workflow.json does not exist")
        with open(workflow_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        node_names = {node["name"] for node in data["nodes"]}
        expected_critical_nodes = {
            "Check Critical Severity",
            "Auto Opt-In Critical Notification (Supabase)",
            "Respond to Webhook",
        }
        self.assertTrue(expected_critical_nodes.issubset(node_names))
        # Assert condition checks severity == Critical
        if_node = next(n for n in data["nodes"] if n["name"] == "Check Critical Severity")
        condition = if_node["parameters"]["conditions"]["string"][0]
        self.assertIn("Critical", condition["value2"])
if __name__ == "__main__":
    unittest.main()
def test_reminder_notifier_multi_entity_workflow_json_validity():
    workflow_path = Path("n8n/reminder_notifier_workflow.json")
    assert workflow_path.exists(), "n8n/reminder_notifier_workflow.json does not exist"
    with open(workflow_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "nodes" in data
    assert "connections" in data
    node_names = {node["name"] for node in data["nodes"]}
    expected_nodes = {
        "Daily Cron Trigger",
        "Fetch Due Services",
        "Fetch Insurance Expiries",
        "Fetch PUC Expiries",
        "Fetch FASTag Accounts",
        "Aggregate Multi-Entity Alerts",
        "Deduplicate Alerts",
        "Queue Reminders",
        "Send Email via Provider (Resend/SendGrid)",
    }
    assert expected_nodes.issubset(node_names)
    # Verify Email Provider Node integration
    email_node = next(n for n in data["nodes"] if n["name"] == "Send Email via Provider (Resend/SendGrid)")
    assert "resend" in email_node["parameters"]["url"].lower() or "sendgrid" in email_node["parameters"]["url"].lower()
def test_fault_diagnosis_critical_alert_wiring():
    workflow_path = Path("n8n/fault_diagnosis_workflow.json")
    assert workflow_path.exists(), "n8n/fault_diagnosis_workflow.json does not exist"
    with open(workflow_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    node_names = {node["name"] for node in data["nodes"]}
    expected_critical_nodes = {
        "Check Critical Severity",
        "Auto Opt-In Critical Notification (Supabase)",
        "Trigger Instant Critical Email (Resend/SendGrid)",
    }
    assert expected_critical_nodes.issubset(node_names)
    # Assert condition checks severity == Critical
    if_node = next(n for n in data["nodes"] if n["name"] == "Check Critical Severity")
    condition = if_node["parameters"]["conditions"]["string"][0]
    assert "Critical" in condition["value2"]
