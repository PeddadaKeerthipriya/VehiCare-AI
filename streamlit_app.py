import os
import requests
import streamlit as st
from supabase import create_client


# ---------------------------------------------------------
# PAGE (must be the first Streamlit call)
# ---------------------------------------------------------

st.set_page_config(
    page_title="VehCare AI",
    page_icon="🚗",
    layout="wide",
)


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------
# On Streamlit Community Cloud, values entered in the app's
# "Secrets" panel land in st.secrets, NOT in os.environ. This
# checks st.secrets first (for cloud deploys) and falls back
# to plain env vars (for local dev / other hosts).

def _get_config(key: str) -> str | None:
    try:
        if key in st.secrets:
            return st.secrets[key]
    except Exception:
        pass
    return os.getenv(key)


SUPABASE_URL = _get_config("SUPABASE_URL")
SUPABASE_ANON_KEY = _get_config("SUPABASE_ANON_KEY")
FASTAPI_URL = _get_config("FASTAPI_URL")

_missing = [
    name for name, val in [
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_ANON_KEY", SUPABASE_ANON_KEY),
        ("FASTAPI_URL", FASTAPI_URL),
    ] if not val
]

if _missing:
    st.error(
        "Missing required configuration: "
        + ", ".join(_missing)
        + ". Set these in .streamlit/secrets.toml (Streamlit Cloud) "
          "or as environment variables (local/other hosts). "
          "See .streamlit/secrets.toml.example."
    )
    st.stop()

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
)


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

if "session" not in st.session_state:
    st.session_state.session = None


if st.session_state.session is None:

    st.title("🚗 VehCare AI")
    st.subheader("Vehicle Maintenance Dashboard")

    st.markdown("### Sign in")

    email = st.text_input(
        "Email",
        placeholder="Enter your email",
    )

    password = st.text_input(
        "Password",
        type="password",
    )

    if st.button("Sign In", type="primary"):

        if not email or not password:
            st.warning("Please enter your email and password.")

        else:
            try:
                response = supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": password,
                })

                st.session_state.session = response.session

                st.success("Login successful!")

                st.rerun()

            except Exception as exc:
                st.error(f"Login failed: {exc}")

    st.stop()


# ---------------------------------------------------------
# AUTHENTICATED USER
# ---------------------------------------------------------

session = st.session_state.session

access_token = session.access_token


# ---------------------------------------------------------
# SIDEBAR
# ---------------------------------------------------------

with st.sidebar:

    st.title("🚗 VehCare AI")

    st.write(
        f"Logged in as: "
        f"{session.user.email}"
    )

    if st.button("Logout"):

        try:
            supabase.auth.sign_out()
        except Exception:
            pass

        st.session_state.session = None

        st.rerun()


# ---------------------------------------------------------
# LOAD DASHBOARD
# ---------------------------------------------------------

try:

    response = requests.get(
        f"{FASTAPI_URL.rstrip('/')}/dashboard/",
        headers={
            "Authorization": f"Bearer {access_token}"
        },
        timeout=30,
    )

    if response.status_code == 401:
        st.error(
            "Your session has expired. "
            "Please log in again."
        )

        st.session_state.session = None
        st.stop()

    response.raise_for_status()

    dashboard = response.json()

except requests.exceptions.RequestException as exc:

    st.error(
        "Could not connect to the VehCare backend."
    )

    st.code(str(exc))

    st.stop()


# ---------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------

st.title("Dashboard")

health = dashboard.get(
    "health_summary",
    {},
)


# ---------------------------------------------------------
# SUMMARY CARDS
# ---------------------------------------------------------

col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric(
        "🚗 Vehicles",
        health.get("total_vehicles", 0),
    )

with col2:
    st.metric(
        "🔧 Maintenance Due",
        health.get("maintenance_due", 0),
    )

with col3:
    st.metric(
        "⚠️ Overdue",
        health.get("maintenance_overdue", 0),
    )

with col4:
    st.metric(
        "🚨 Critical Diagnoses",
        health.get("critical_diagnoses", 0),
    )


st.divider()


# ---------------------------------------------------------
# VEHICLES
# ---------------------------------------------------------

st.header("Your Vehicles")

vehicles = dashboard.get(
    "vehicles",
    [],
)

if not vehicles:

    st.info("No vehicles found.")

else:

    for vehicle in vehicles:

        make = vehicle.get("make", "")
        model = vehicle.get("model", "")
        year = vehicle.get("year", "")
        vehicle_type = vehicle.get(
            "vehicle_type",
            "",
        )
        odometer = vehicle.get(
            "odometer_km",
            "",
        )

        with st.container(border=True):

            st.subheader(
                f"{make} {model}"
            )

            c1, c2, c3 = st.columns(3)

            with c1:
                st.write(f"**Year:** {year}")

            with c2:
                st.write(
                    f"**Type:** {vehicle_type}"
                )

            with c3:
                st.write(
                    f"**Odometer:** "
                    f"{odometer} km"
                )


# ---------------------------------------------------------
# RECENT ACTIVITY
# ---------------------------------------------------------

st.divider()

st.header("Recent Activity")

activities = dashboard.get(
    "recent_activity",
    [],
)

if not activities:

    st.info("No recent activity.")

else:

    for activity in activities:

        activity_type = activity.get(
            "type",
            "",
        )

        title = activity.get(
            "title",
            "Activity",
        )

        vehicle = activity.get(
            "vehicle",
            "",
        )

        date = activity.get(
            "date",
            "",
        )

        description = activity.get(
            "description",
            "",
        )

        if activity_type == "diagnosis":

            icon = "🚨"

        else:

            icon = "🔧"

        with st.container(border=True):

            st.write(
                f"{icon} **{title}**"
            )

            if vehicle:
                st.write(
                    f"Vehicle: {vehicle}"
                )

            if date:
                st.write(
                    f"Date: {date}"
                )

            if description:
                st.write(
                    description
                )


# ---------------------------------------------------------
# 90-DAY TIMELINE
# ---------------------------------------------------------

st.divider()

st.header("90-Day Service Timeline")

timeline = dashboard.get(
    "timeline_90_days",
    [],
)

if not timeline:

    st.info(
        "No service records in the last 90 days."
    )

else:

    for item in timeline:

        st.write(
            f"🔧 **{item.get('title', 'Service')}**"
        )

        st.write(
            f"Vehicle: {item.get('vehicle', '')}"
        )

        st.write(
            f"Date: {item.get('date', '')}"
        )

        if item.get("description"):
            st.write(
                item["description"]
            )

        st.divider()
