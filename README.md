
# VehiCare Backend

Backend API for the **VehiCare vehicle maintenance application**, built using FastAPI and Supabase.

## Overview

This backend provides secure authentication APIs and manages vehicle maintenance, diagnosis, notifications, and related backend operations.

## Tech Stack

* Python
* FastAPI
* Pydantic
* Supabase / PostgreSQL
* Uvicorn
* Swagger / OpenAPI
* n8n

## Deploy the frontend to Vercel

Vercel hosts the Next.js frontend. The FastAPI backend and n8n workflows must
remain deployed on a public server such as the Hostinger VPS described in
`DEPLOY_HOSTINGER_VPS.md`.

1. Import this repository into Vercel. Vercel should detect Next.js
	automatically. Keep the root directory as the repository root and use the
	default build command, `npm run build`.
2. In the Vercel project settings, add these environment variables for the
	Preview and Production environments:

```text
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`NEXT_PUBLIC_API_URL` must point to the deployed FastAPI service, not
`localhost`. Configure CORS on that service to allow the Vercel domain. Do not
add backend secrets such as `SUPABASE_SERVICE_ROLE_KEY` or provider API keys
to the frontend project.

3. Deploy the project. After the first deployment, add the final Vercel URL to
	Supabase Authentication URL configuration and update the backend CORS
	allowlist if required.

## Project Setup

1. Clone the repository.
2. Install the required packages:

```bash
pip install -r requirements.txt