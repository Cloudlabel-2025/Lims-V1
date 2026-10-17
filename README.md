# LIMS Core

Multi-tenant laboratory information management system built with Next.js, React, and MongoDB.

## Current Architecture

- Master database stores platform labs, developer users, permissions, and tenant role templates.
- Each lab uses tenant-scoped MongoDB models through `src/app/lib/tenant-db.js`.
- Tenant users authenticate with secure session cookies and RBAC permissions.
- The main front-desk transaction module is **Billing**.
- Billing records contain patient investigations, payable amount, payment status, referral commission, and workflow state.
- Samples and reports connect to billing records through `BillingRecord`.

## Billing Module

The project intentionally maintains Billing as the only front-desk transaction module.

Core files:

- `src/app/(dashboard)/billing/page.js`
- `src/app/api/billing/route.js`
- `src/app/api/billing/[id]/route.js`
- `src/app/api/billing/settle/route.js`
- `src/app/models/tenant/BillingRecord.js`

Primary identifiers:

- Model: `BillingRecord`
- Public bill number: `billId`
- Permissions: `billing.view`, `billing.create`, `billing.collect`, `billing.update`, `billing.cancel`

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`.

## Setup Notes

Required environment variables include MongoDB connection settings and session secrets. See the tenant, auth, and onboarding code under `src/app/lib` and `scripts` for the current expected values.

The app and master seed scripts use `MASTER_DB_NAME`, defaulting to `CMS`. Configure `MASTER_MONGODB_URI` (or the fallback `MONGODB_URI`) in `.env.local`. To start fresh without copying employee or tenant data, set `MASTER_DB_NAME` to a new, unused database name and configure the new connection if changing clusters. Restart the app after changing these settings. To initialize platform permissions, subscription packages, and developer admin access, run:

```bash
npm run seed:rbac
npm run seed:subscriptions
npm run seed:developer
```

The developer seed uses `DEVELOPER_OWNER_EMAIL` and `DEVELOPER_OWNER_PASSWORD`, with optional `DEVELOPER_OWNER_FIRST_NAME` and `DEVELOPER_OWNER_LAST_NAME`. Rerunning it resets seeded developer passwords and activates the accounts. Additional CMS developers come from `CMS_DEVELOPER_EMAILS`; if omitted, the existing defaults in `scripts/seed-developer-owner.mjs` apply.

The separate `scripts/migrate-test-to-cms.mjs` script copies collections from `test` to `CMS` and deletes existing destination documents first. Check the source and destination before running it against an existing database.

Password reset emails use Resend when configured:

- `RESEND_API_KEY`
- `RESET_EMAIL_FROM`
- `PASSWORD_RESET_BASE_URL` optional, for example `https://app.example.com`
