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

Password reset emails use Resend when configured:

- `RESEND_API_KEY`
- `RESET_EMAIL_FROM`
- `PASSWORD_RESET_BASE_URL` optional, for example `https://app.example.com`
