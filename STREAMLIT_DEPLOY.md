# Deploying the Streamlit dashboard

`streamlit_app.py` is a lightweight, read-only dashboard (login + vehicle
summary + recent activity + 90-day timeline). It talks to your already-
deployed FastAPI backend over HTTP — it does not run the backend itself.

**Backend (already deployed):** `https://vehicare-ai.onrender.com`
**API docs:** `https://vehicare-ai.onrender.com/docs`

## Steps

1. Push this repo to GitHub (main branch).
2. Go to [share.streamlit.io](https://share.streamlit.io), "New app",
   point it at this repo, branch `main`, main file path
   `streamlit_app.py`.
3. In the app's **Settings → Secrets**, paste the contents of
   `.streamlit/secrets.toml.example` with real Supabase values filled
   in (the `FASTAPI_URL` is already correct):
   ```toml
   SUPABASE_URL = "https://xxxx.supabase.co"
   SUPABASE_ANON_KEY = "..."
   FASTAPI_URL = "https://vehicare-ai.onrender.com"
   ```
4. Deploy.

## Local run

```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml   # fill in Supabase values
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Note on the Render free tier

If the backend is on Render's free tier, it spins down after ~15
minutes of inactivity and the next request takes 30-60s to wake it
back up. The Streamlit dashboard's first request after idle time may
time out or feel slow — that's the backend cold-starting, not a bug in
the dashboard. Upgrading to a paid Render instance removes this.

## What was fixed in streamlit_app.py for deployment

- It previously read config with `os.getenv(...)` only. Streamlit
  Cloud secrets land in `st.secrets`, not the OS environment, so it
  would have failed on Cloud even with secrets configured correctly.
  It now checks `st.secrets` first, falling back to env vars for
  local/non-Cloud runs.
- `st.set_page_config()` was previously called after other `st.*`
  calls, which Streamlit requires to be the very first call — moved
  to the top.
- Missing config previously showed `st.error()` but let execution
  continue into a crash; it now stops cleanly with `st.stop()`.
