"""
Predictive Maintenance & Compliance Rules Engine for VehiCare.

This module evaluates vehicle telemetry (odometer), service history,
custom interval overrides, and compliance records (Insurance, PUC, FASTag)
to compute due dates, remaining kilometers/days, and alert statuses.
"""

import re
from datetime import datetime, date, timedelta
import calendar
from typing import Dict, List, Any, Optional


OEM_INTERVALS = {
    'oil': {
        'km': 10000,
        'months': 12,
        'name': 'Engine Oil Replacement'
    },
    'tyre': {
        'km': 10000,
        'months': 6,
        'name': 'Tyre Rotation / Replacement'
    },
    'brake': {
        'km': 30000,
        'months': 36,
        'name': 'Brake System Inspection & Pads'
    },
    'battery': {
        'km': 40000,
        'months': 48,
        'name': 'Battery Health & Replacement'
    },
    'air_filter': {
        'km': 20000,
        'months': 24,
        'name': 'Engine Air Filter Replacement'
    }
}


def parse_date(date_val: Any) -> Optional[date]:
    """
    Safely parse date strings (ISO, YYYY-MM-DD) or datetime objects to a date object.
    """
    if not date_val:
        return None
    if isinstance(date_val, datetime):
        return date_val.date()
    if isinstance(date_val, date):
        return date_val
    try:
        clean_str = str(date_val).split('T')[0].strip()
        return datetime.strptime(clean_str, '%Y-%m-%d').date()
    except Exception:
        return None


def add_months(source_date: date, months: int) -> date:
    """
    Add months to a date safely handling month-end boundaries without third-party libraries.
    """
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def match_component(service_type: str, notes: str = "") -> Optional[str]:
    """
    Identify component from service type or notes description.
    """
    text = f"{service_type or ''} {notes or ''}".lower()
    if 'oil' in text:
        return 'oil'
    elif 'tyre' in text or 'tire' in text:
        return 'tyre'
    elif 'brake' in text:
        return 'brake'
    elif 'battery' in text:
        return 'battery'
    elif 'filter' in text:
        return 'air_filter'
    return None


def extract_odometer_from_notes(notes: Optional[str]) -> Optional[int]:
    """
    Extracts numerical odometer/mileage reading from service slip notes or user input.
    """
    if not notes:
        return None
    match = re.search(r'(?:odometer|mileage|km|odo)\s*[:\-]?\s*(\d[\d,]*)', notes, re.IGNORECASE)
    if match:
        try:
            return int(match.group(1).replace(',', ''))
        except ValueError:
            return None
    return None


def evaluate_predictive_maintenance(
    vehicle: Dict[str, Any],
    service_records: Optional[List[Dict[str, Any]]] = None,
    custom_intervals: Optional[List[Dict[str, Any]]] = None,
    insurance: Optional[Dict[str, Any]] = None,
    puc: Optional[Dict[str, Any]] = None,
    fastag: Optional[Dict[str, Any]] = None,
    reference_date: Optional[date] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates maintenance schedules and compliance checks for a vehicle.

    Parameters:
        vehicle: Vehicle dictionary containing id, odometer_km, created_at/purchase_date.
        service_records: List of historical service records.
        custom_intervals: List of user-defined interval overrides.
        insurance: Optional insurance document dict.
        puc: Optional PUC certification dict.
        fastag: Optional FASTag balance dict.
        reference_date: Optional reference date for testing (defaults to today).

    Returns:
        List of maintenance schedule items with status, due dates, due odometers, and remaining metrics.
    """
    today = reference_date or date.today()
    vehicle = vehicle or {}
    service_records = service_records or []
    custom_intervals = custom_intervals or []

    vehicle_id = vehicle.get('id')
    current_odometer = int(vehicle.get('odometer_km') or 0)
    vehicle_reg_date = parse_date(vehicle.get('created_at') or vehicle.get('purchase_date')) or today

    # 1. Build custom interval overrides & custom components
    overrides: Dict[str, Dict[str, Any]] = {}
    custom_tasks: Dict[str, Dict[str, Any]] = {}

    for ci in custom_intervals:
        raw_comp = ci.get('component') or ''
        task_name = ci.get('task_name') or ''
        comp_key = (raw_comp or match_component(task_name) or task_name).lower().strip()

        if not comp_key:
            continue

        raw_km = ci.get('interval_km')
        raw_months = ci.get('interval_months')
        if raw_months is None and ci.get('interval_days') is not None:
            raw_months = max(1, int(ci.get('interval_days', 0)) // 30)

        override_entry: Dict[str, Any] = {
            'km': int(raw_km) if raw_km is not None else None,
            'months': int(raw_months) if raw_months is not None else None,
            'name': task_name or ci.get('name')
        }

        if comp_key in OEM_INTERVALS:
            overrides[comp_key] = override_entry
        else:
            custom_tasks[comp_key] = {
                'km': int(raw_km) if raw_km is not None else 10000,
                'months': int(raw_months) if raw_months is not None else 12,
                'name': task_name or raw_comp.title() or comp_key.title()
            }

    # 2. Extract latest service record per component
    last_services: Dict[str, Dict[str, Any]] = {}
    for sr in service_records:
        comp = match_component(sr.get('service_type', ''), sr.get('notes', ''))
        if not comp:
            # Fallback: check if service_type / notes matches any custom task
            text = f"{sr.get('service_type', '')} {sr.get('notes', '')}".lower()
            for custom_k in custom_tasks:
                if custom_k in text or text in custom_k:
                    comp = custom_k
                    break

        if comp:
            rec_date = parse_date(sr.get('service_date'))
            rec_odo = int(sr.get('odometer_km') or sr.get('odometer') or 0)
            if rec_date:
                if comp not in last_services or rec_date > last_services[comp]['date']:
                    last_services[comp] = {'date': rec_date, 'odometer': rec_odo}

    results: List[Dict[str, Any]] = []

    # 3. Standard Components Evaluation (with Custom Interval Overrides)
    for comp_key, default_cfg in OEM_INTERVALS.items():
        override = overrides.get(comp_key, {})
        interval_km = override.get('km') if override.get('km') is not None else default_cfg['km']
        interval_months = override.get('months') if override.get('months') is not None else default_cfg['months']
        task_name = override.get('name') or default_cfg['name']

        last_rec = last_services.get(comp_key, {'date': vehicle_reg_date, 'odometer': 0})

        due_odometer = last_rec['odometer'] + interval_km
        due_date = add_months(last_rec['date'], interval_months)

        remaining_km = due_odometer - current_odometer
        remaining_days = (due_date - today).days

        if remaining_km <= 0 or remaining_days <= 0:
            status = 'overdue'
        elif remaining_km <= 1000 or remaining_days <= 7:
            status = 'due_soon'
        else:
            status = 'pending'

        results.append({
            "vehicle_id": vehicle_id,
            "category": "maintenance",
            "component": comp_key,
            "task_name": task_name,
            "due_date": due_date.strftime('%Y-%m-%d'),
            "due_odometer_km": due_odometer,
            "remaining_km": remaining_km,
            "remaining_days": remaining_days,
            "status": status,
            "last_service_date": last_rec['date'].strftime('%Y-%m-%d'),
            "last_service_odometer": last_rec['odometer']
        })

    # 3.5 Custom Component Evaluation (Additional User-Defined Tasks)
    for comp_key, custom_cfg in custom_tasks.items():
        last_rec = last_services.get(comp_key, {'date': vehicle_reg_date, 'odometer': 0})

        due_odometer = last_rec['odometer'] + custom_cfg['km']
        due_date = add_months(last_rec['date'], custom_cfg['months'])

        remaining_km = due_odometer - current_odometer
        remaining_days = (due_date - today).days

        if remaining_km <= 0 or remaining_days <= 0:
            status = 'overdue'
        elif remaining_km <= 1000 or remaining_days <= 7:
            status = 'due_soon'
        else:
            status = 'pending'

        results.append({
            "vehicle_id": vehicle_id,
            "category": "maintenance",
            "component": comp_key,
            "task_name": custom_cfg['name'],
            "due_date": due_date.strftime('%Y-%m-%d'),
            "due_odometer_km": due_odometer,
            "remaining_km": remaining_km,
            "remaining_days": remaining_days,
            "status": status,
            "last_service_date": last_rec['date'].strftime('%Y-%m-%d'),
            "last_service_odometer": last_rec['odometer']
        })

    # 4. Compliance: Insurance Expiry Check
    if insurance:
        ins_expiry = parse_date(insurance.get('expiry_date'))
        if ins_expiry:
            days_left = (ins_expiry - today).days
            if days_left <= 0:
                ins_status = 'overdue'
            elif days_left <= 15:
                ins_status = 'due_soon'
            else:
                ins_status = 'pending'

            results.append({
                "vehicle_id": vehicle_id,
                "category": "compliance",
                "component": "insurance",
                "task_name": "Insurance Policy Renewal",
                "due_date": ins_expiry.strftime('%Y-%m-%d'),
                "due_odometer_km": None,
                "remaining_km": None,
                "remaining_days": days_left,
                "status": ins_status,
                "policy_number": insurance.get('policy_number'),
                "provider": insurance.get('provider')
            })

    # 5. Compliance: PUC Expiry Check
    if puc:
        puc_expiry = parse_date(puc.get('expiry_date'))
        if puc_expiry:
            days_left = (puc_expiry - today).days
            if days_left <= 0:
                puc_status = 'overdue'
            elif days_left <= 7:
                puc_status = 'due_soon'
            else:
                puc_status = 'pending'

            results.append({
                "vehicle_id": vehicle_id,
                "category": "compliance",
                "component": "puc",
                "task_name": "PUC Certification Renewal",
                "due_date": puc_expiry.strftime('%Y-%m-%d'),
                "due_odometer_km": None,
                "remaining_km": None,
                "remaining_days": days_left,
                "status": puc_status,
                "certificate_number": puc.get('certificate_number')
            })

    # 6. Compliance: FASTag Balance & Expiry Check
    if fastag:
        balance = float(fastag.get('balance') or 0.0)
        low_balance_flag = bool(fastag.get('low_balance_flag', False))
        ft_expiry = parse_date(fastag.get('expiry_date') or fastag.get('last_recharge_date'))
        
        days_left = (ft_expiry - today).days if ft_expiry else None
        
        if balance <= 100.0 or low_balance_flag or (days_left is not None and days_left <= 0):
            ft_status = 'overdue'
        elif balance <= 250.0 or (days_left is not None and days_left <= 7):
            ft_status = 'due_soon'
        else:
            ft_status = 'pending'

        results.append({
            "vehicle_id": vehicle_id,
            "category": "compliance",
            "component": "fastag",
            "task_name": "FASTag Account Recharge",
            "due_date": ft_expiry.strftime('%Y-%m-%d') if ft_expiry else None,
            "due_odometer_km": None,
            "remaining_km": None,
            "remaining_days": days_left,
            "status": ft_status,
            "current_balance": balance,
            "tag_id": fastag.get('tag_id')
        })

    return results


def trigger_predictor_rerun(
    vehicle_id: str,
    service_record_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Triggers the predictive-maintenance rules engine for a vehicle.
    Fetches vehicle telemetry, service history, custom/OEM intervals,
    evaluates due dates and statuses, and persists the maintenance schedules to Supabase.
    """
    from app.database import supabase
    import requests

    print("====================================")
    print("PREDICTOR AUTO-RERUN TRIGGERED")
    print("VEHICLE ID:", vehicle_id)
    if service_record_id:
        print("SERVICE RECORD ID:", service_record_id)
    print("====================================")

    service_role_key = getattr(supabase, "supabase_service_role_key", None)
    schedules = []

    if service_role_key and getattr(supabase, "supabase_url", None):
        try:
            headers = {"apikey": str(service_role_key), "Authorization": f"Bearer {service_role_key}"}
            v_resp = requests.get(
                f"{supabase.supabase_url}/rest/v1/vehicles?id=eq.{vehicle_id}&select=*",
                headers=headers,
                timeout=10
            )
            sr_resp = requests.get(
                f"{supabase.supabase_url}/rest/v1/service_records?vehicle_id=eq.{vehicle_id}&select=*",
                headers=headers,
                timeout=10
            )
            ci_resp = requests.get(
                f"{supabase.supabase_url}/rest/v1/custom_intervals?vehicle_id=eq.{vehicle_id}&select=*",
                headers=headers,
                timeout=10
            )

            if v_resp.status_code == 200 and v_resp.json():
                v_data = v_resp.json()[0]
                sr_data = sr_resp.json() if sr_resp.status_code == 200 else []
                ci_data = ci_resp.json() if ci_resp.status_code == 200 else []

                # If no custom intervals for vehicle, optionally load OEM intervals from DB
                if not ci_data:
                    oem_resp = requests.get(
                        f"{supabase.supabase_url}/rest/v1/oem_intervals?select=*",
                        headers=headers,
                        timeout=10
                    )
                    if oem_resp.status_code == 200:
                        ci_data = oem_resp.json()

                schedules = evaluate_predictive_maintenance(
                    vehicle=v_data,
                    service_records=sr_data,
                    custom_intervals=ci_data
                )

                # Persist evaluated schedules to maintenance_schedules table
                for sched in schedules:
                    if sched.get("category") == "maintenance":
                        sched_payload = {
                            "vehicle_id": vehicle_id,
                            "task_name": sched.get("task_name"),
                            "due_date": sched.get("due_date"),
                            "due_odometer_km": sched.get("due_odometer_km"),
                            "status": sched.get("status", "pending")
                        }
                        try:
                            requests.post(
                                f"{supabase.supabase_url}/rest/v1/maintenance_schedules",
                                headers={**headers, "Prefer": "resolution=merge-duplicates", "Content-Type": "application/json"},
                                json=sched_payload,
                                timeout=5
                            )
                        except Exception as persist_err:
                            print("Warning persisting schedule:", persist_err)

        except Exception as e:
            print("Error during in-process predictor rerun:", e)

    return {
        "triggered": True,
        "vehicle_id": vehicle_id,
        "service_record_id": service_record_id,
        "schedules_evaluated": len(schedules),
        "schedules": schedules
    }
