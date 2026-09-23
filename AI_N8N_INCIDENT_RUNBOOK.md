# VehiCare — AI & Automation Engineering Incident Runbook & Production Guide

**Document Version:** 1.0.0  
**Status:** APPROVED & PRODUCTION READY  
**Author:** AI & Automation Engineering Team  

---

## 🎯 Scope & Purpose

This runbook serves as the operational guide for maintaining, monitoring, troubleshooting, and operating all **5 VehiCare n8n Automation Workflows** and **3 AI LLM Pipelines** in production.

---

## 📊 1. Workflow Architecture & Status Matrix

| Workflow Name | File | Primary Trigger | Target Tables / Services | Production Status |
|---|---|---|---|---|
| **1. Service Slip OCR & Intelligence** | [`n8n/service_slip_workflow.json`](./n8n/service_slip_workflow.json) | Webhook (`/service-slip-uploaded`) | `public.service_slips` | **READY (Vision LLM)** |
| **2. Fault Diagnosis Intelligence** | [`n8n/fault_diagnosis_workflow.json`](./n8n/fault_diagnosis_workflow.json) | Webhook (`/diagnose`) | `public.fault_diagnoses`, `public.notifications` | **READY (Claude 3 Haiku)** |
| **3. Predictive Maintenance Trigger** | [`n8n/predictive_maintenance_trigger_workflow.json`](./n8n/predictive_maintenance_trigger_workflow.json) | Webhook / Mileage Update | `public.maintenance_schedules` | **READY (Batch Upsert)** |
| **4. Multi-Entity Reminder Notifier** | [`n8n/reminder_notifier_workflow.json`](./n8n/reminder_notifier_workflow.json) | Daily Cron (09:00 AM) | `public.notifications` (In-App) | **READY (Sync Batched)** |
| **5. Weekly Vehicle Health Reporter** | [`n8n/vehicle_health_reporter_workflow.json`](./n8n/vehicle_health_reporter_workflow.json) | Weekly Cron (Monday 09:00 AM) | `public.notifications` (In-App) | **READY (Throttled LLM)** |

---

## 🔒 2. Prompt Versions & Freeze Registry

All core prompts are frozen at **Version 1.0.0** with strict tag isolation and XML breakout defense:

| Prompt Module | Version | Temperature | Target Model | Location |
|---|---|---|---|---|
| **Fault Diagnosis** | `v1.0.0` | `0.1` | Claude 3 Haiku | [`app/prompts/diagnosis_v1.py`](./app/prompts/diagnosis_v1.py) |
| **Weekly Health Reporter** | `v1.0.0` | `0.3` | Claude 3 Haiku / DeepSeek | [`app/prompts/health_reporter_v1.py`](./app/prompts/health_reporter_v1.py) |
| **Invoice Slip Extraction** | `v1.0.0` | `0.0` | Claude 3 Haiku Vision | [`app/prompts/slip_extraction_v1.py`](./app/prompts/slip_extraction_v1.py) |

---

## 🛠️ 3. Production Incident Troubleshooting Guide

### Incident 1: HTTP 402 / 429 "Payment Required / In-Flight Request" on OpenRouter
* **Root Cause:** Burst concurrency exceeding prepaid credit reservation.
* **Resolution in Place:**
  - n8n node `Generate LLM Health Summary` is configured with `options.batching`: `batchSize: 1` and `batchInterval: 1000`.
  - In-flight requests are strictly capped at 1.

### Incident 2: "Target 127.0.0.1 is not allowed (SSRF)"
* **Root Cause:** Calling `localhost:8000` from n8n Cloud.
* **Resolution in Place:**
  - The Service Slip OCR workflow uses **OpenRouter Vision** (`anthropic/claude-3-haiku`), eliminating all localhost dependencies.

### Incident 3: "Invalid Base64 / filesystem-v2"
* **Root Cause:** n8n Cloud stores binary files on disk, returning pointer strings (`filesystem-v2`).
* **Resolution in Place:**
  - Use `await this.helpers.getBinaryDataBuffer(i, binaryKey)` to retrieve the true binary buffer and convert to base64.

### Incident 4: "maintenance_schedules_vehicle_id_fkey violation"
* **Root Cause:** Incorrect entity ID mapping from intermediate nodes.
* **Resolution in Place:**
  - Rules engine references `$('Fetch Vehicle Odometer').first()?.json?.id`, ensuring foreign keys match `public.vehicles(id)`.

---

## 🧪 4. Live Verification Checklist

Run full automated test verification at any time:
```powershell
python -m pytest -p no:asyncio tests/
```
**Expected Result:** `65 passed (100%)`
