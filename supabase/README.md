\# VehiCare — Data Layer Overview



This document covers the Supabase database structure, security model, and backup system maintained by Data Engineering. For day-to-day schema changes, see `migrations/`.



\## Core Tables



| Table | Purpose |

|---|---|

| `vehicles` | User-registered vehicles |

| `service\_records` | Service history (repairs, costs, mileage) |

| `service\_slips` | OCR-parsed service slip uploads |

| `fault\_diagnoses` | AI diagnosis history (severity, cause, recommended action) |

| `maintenance\_schedules` | Upcoming maintenance due dates |

| `custom\_intervals` | User-defined maintenance interval overrides |

| `insurance\_policies` | Insurance policy + expiry tracking |

| `puc\_certificates` | Pollution certificate + expiry tracking |

| `fastag\_accounts` | FASTag balance/status (reminders trigger on low balance, not expiry) |

| `notifications` | Notification delivery log |

| `notification\_preferences` | Per-user channel preferences (in-app/email/SMS) |

| `users` | User profiles |

| `oem\_intervals` | Shared OEM reference intervals (read-only reference data — not user-writable; do not confuse with `custom\_intervals`) |

| `service\_center\_cache` | TTL cache for Google Places/Maps lookups |



\## Row-Level Security (RLS)



Every user-owned table is scoped by vehicle or user ownership — a user can only read/write their own data. Ownership is enforced via policies checking `auth.uid()` against either `user\_id` directly, or a `vehicles` ownership subquery for vehicle-linked tables.



`oem\_intervals` and `service\_center\_cache` are shared reference/cache tables and are intentionally not user-scoped — they hold no personal data.



A full RLS audit was completed and passed across all core tables (see commit history for details).



\## Automated Data Retention



\- \*\*Notifications\*\*: auto-deleted after 180 days via a scheduled `pg\_cron` job (`cleanup\_old\_notifications`).



\## Backup System



Since the Supabase project is on the Free plan (no built-in backups or point-in-time recovery), a self-managed daily backup runs via n8n:



\*\*Flow:\*\* `Schedule Trigger → Fetch all 12 core tables via Supabase REST API → Combine into one JSON file → Upload to a private Backblaze B2 bucket → Delete backups older than 14 days`



\- Runs daily, fully automated, published/active in n8n Cloud

\- Cost: effectively $0 (within Backblaze's free 10GB tier)

\- Workflow exported for reference at `n8n/backup\_vehicareai\_workflow.json` (credentials redacted)

\- \*\*Restore access:\*\* handled personally by the Data Engineer — not distributed to the team. Contact for any restore needs.

\- \*\*Scope:\*\* covers table data only. Schema/RLS live in `migrations/`. Uploaded files (photos/docs), if introduced later, are not yet covered.



\## Migration Workflow



\- All schema changes go through `supabase migration new <name>` → edit → `supabase db push` → commit to git

\- Never apply schema changes directly via the Supabase dashboard SQL editor without also creating a matching migration file — this causes migration history drift (see `migration repair` in git history for past recovery instances)

