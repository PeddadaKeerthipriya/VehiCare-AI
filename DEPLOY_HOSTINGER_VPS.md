# Deploying VehiCare to a Hostinger VPS

This deploys the **Next.js frontend** and the **FastAPI backend** together
on one Hostinger VPS, using Docker Compose and Caddy (automatic HTTPS).
Supabase stays managed/hosted by Supabase — you are not self-hosting it.

Everything below is one-time setup. Once it's done, redeploying a new
version is a 3-line update (see the end of this doc).

---

## 0. What to buy

- **Hostinger VPS**, Ubuntu 22.04 or 24.04 image. A 2 vCPU / 4 GB RAM
  plan (Hostinger's "KVM 2" tier or similar) is comfortable for this
  app; the cheapest 1 vCPU / 1-2 GB tier can work but is tight when
  `next build` runs during image builds.
- **A domain name**, with access to its DNS settings (can be bought
  through Hostinger or anywhere else).

---

## 1. Point your domain at the VPS

In your domain's DNS settings, add two **A records** pointing at your
VPS's public IPv4 address (shown in the Hostinger VPS dashboard):

| Type | Name | Value          |
|------|------|----------------|
| A    | @    | your.vps.ip.address |
| A    | api  | your.vps.ip.address |

This gives you `yourdomain.com` (frontend) and `api.yourdomain.com`
(backend). DNS can take a few minutes to a few hours to propagate —
you can continue the steps below while you wait, but Caddy's
automatic HTTPS (step 6) won't succeed until it has propagated.

---

## 2. Connect to the VPS and do basic hardening

From the Hostinger dashboard, get your VPS's IP and root password (or
set up an SSH key there — recommended).

```bash
ssh root@your.vps.ip.address
```

```bash
# Update the system
apt update && apt upgrade -y

# Create a non-root user to work as
adduser deploy
usermod -aG sudo deploy

# Basic firewall: only allow SSH, HTTP, HTTPS
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Switch to the new user for everything else
su - deploy
```

---

## 3. Install Docker and Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # applies the group change without needing to log out

docker --version
docker compose version
```

---

## 4. Get the code onto the VPS

Either clone from GitHub (recommended, makes future updates a `git
pull`) or upload the zip.

```bash
git clone https://github.com/Credencer-Technologies/VehiCare-AI.git
cd VehiCare-AI
git checkout main
```

If you're uploading the zip instead: `scp` it to the VPS, then
`unzip VehiCare-AI.zip && cd VehiCare-AI`.

---

## 5. Set up environment variables

```bash
cp .env.example .env
cp .env.backend.example .env.backend
nano .env            # fill in NEXT_PUBLIC_* values
nano .env.backend     # fill in SUPABASE_*, ANTHROPIC_API_KEY, etc.
```

Both files are gitignored — they only ever live on the server (and on
your own machine if you set up local dev). Use your real
`api.yourdomain.com` as `NEXT_PUBLIC_API_URL` in `.env`, since that
value gets baked into the frontend at build time.

Also edit `deploy/caddy/Caddyfile` and replace `yourdomain.com` /
`api.yourdomain.com` with your real domain.

---

## 6. Build and start everything

```bash
docker compose up -d --build
```

This builds the frontend image (`npm ci && npm run build`), the
backend image (`pip install`), and starts both plus Caddy. First
build takes a few minutes. Caddy will automatically request Let's
Encrypt certificates for both domains the first time it starts —
this requires the DNS from step 1 to have already propagated.

Check everything is healthy:

```bash
docker compose ps
docker compose logs -f            # Ctrl+C to stop following
```

Visit `https://yourdomain.com` and `https://api.yourdomain.com/docs`
(FastAPI's interactive docs page) in a browser to confirm both are up.

---

## 7. Run database migrations (if not already applied)

Migrations live in `supabase/migrations/`. Apply them against your
Supabase project using the Supabase CLI (from your own machine or the
VPS — either works, it just talks to Supabase over the network):

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

---

## 8. Ongoing: deploying updates

```bash
cd VehiCare-AI
git pull origin main
docker compose up -d --build
```

Docker Compose only rebuilds images whose source changed, so this is
fast for small changes.

---

## Troubleshooting

- **Caddy can't get a certificate** — usually DNS hasn't propagated
  yet, or ports 80/443 aren't open (`ufw status` to check). Wait and
  retry with `docker compose restart caddy`.
- **Frontend shows old data / wrong API URL** — `NEXT_PUBLIC_*` values
  are baked in at *build* time, not read at runtime. Changing `.env`
  requires `docker compose up -d --build frontend` to take effect.
- **Backend 500s / can't reach Supabase** — check `docker compose logs
  backend` and confirm `.env.backend` has the real
  `SUPABASE_SERVICE_ROLE_KEY`, not the anon key.
- **Out of memory during build** — the frontend build is the heaviest
  step; if the VPS has 1-2 GB RAM, add a swap file:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  ```

---

## What's in this deployment setup

- `Dockerfile.frontend` — multi-stage Next.js build using `output:
  "standalone"` (set in `next.config.mjs`) for a minimal runtime image.
- `Dockerfile.backend` — FastAPI/Uvicorn image, using
  `requirements-backend.txt` (the same deps as `requirements.txt`
  minus `streamlit`, which isn't needed here).
- `docker-compose.yml` — wires frontend, backend, and Caddy together
  on an internal Docker network; only Caddy is exposed to the internet.
- `deploy/caddy/Caddyfile` — reverse proxy + automatic HTTPS config.
- `.env.example`, `.env.backend.example` — templates for the real,
  gitignored `.env` / `.env.backend` files.
