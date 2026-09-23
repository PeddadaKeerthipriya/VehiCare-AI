from datetime import date
from app.database import supabase


def create_expired_compliance_notifications(
    user_id: str,
    auth_token: str,
) -> None:
    """
    Create forced in-app notifications for expired Insurance and PUC records.

    Notifications are created only once per compliance record.
    In-app alerts are not controlled by email/SMS preferences.
    """
    try:
        # Use the authenticated user's PostgREST session.
        supabase.postgrest.auth(auth_token)

        # Get vehicles belonging to the authenticated user.
        vehicles_response = (
            supabase
            .table("vehicles")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

        vehicle_ids = [
            str(vehicle["id"])
            for vehicle in (vehicles_response.data or [])
            if vehicle.get("id")
        ]

        if not vehicle_ids:
            return

        today = date.today().isoformat()

        # Check expired Insurance records.
        insurance_response = (
            supabase
            .table("insurance_policies")
            .select("id, vehicle_id, policy_number, expiry_date")
            .in_("vehicle_id", vehicle_ids)
            .lt("expiry_date", today)
            .execute()
        )

        # Check expired PUC records.
        puc_response = (
            supabase
            .table("puc_certificates")
            .select("id, vehicle_id, certificate_number, expiry_date")
            .in_("vehicle_id", vehicle_ids)
            .lt("expiry_date", today)
            .execute()
        )

        # Create notifications only when an alert does not already exist.
        for policy in insurance_response.data or []:
            _create_if_missing(
                user_id=user_id,
                notification_type="insurance",
                reference_id=str(policy["id"]),
                message=(
                    f"Insurance policy {policy.get('policy_number') or ''} "
                    "has expired. Please renew it."
                ).strip(),
            )

        for puc in puc_response.data or []:
            _create_if_missing(
                user_id=user_id,
                notification_type="puc",
                reference_id=str(puc["id"]),
                message=(
                    f"PUC certificate {puc.get('certificate_number') or ''} "
                    "has expired. Please renew it."
                ).strip(),
            )

    except Exception as exc:
        # Notification generation must not break GET /notifications.
        print("[EXPIRY NOTIFICATION ERROR]", repr(exc))


def _create_if_missing(
    user_id: str,
    notification_type: str,
    reference_id: str,
    message: str,
) -> None:
    """Create an in-app notification unless one already exists."""
    existing = (
        supabase
        .table("notifications")
        .select("id")
        .eq("user_id", user_id)
        .eq("notification_type", notification_type)
        .eq("reference_id", reference_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        return

    supabase.table("notifications").insert(
        {
            "user_id": user_id,
            "channel": "in_app",
            "message": message,
            "notification_type": notification_type,
            "reference_id": reference_id,
        }
    ).execute()
