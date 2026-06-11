# SaaS Custom Domain Management System

Root platform domain: `lims.store`
Hosting provider: Vercel
Application: Next.js / Node.js API
Database: MongoDB

## Objective

Each lab can attach one or more customer-owned domains to its tenant. When a request arrives for `uthiram.in`, middleware resolves that host to the matching `tenant_domains` record and injects the resolved tenant context. The application then loads only that tenant's database and data.

## Architecture

The platform has four layers:

1. Developer domain dashboard for adding, verifying, making primary, and removing domains.
2. Domain service layer for validation, ownership checks, Vercel API calls, lifecycle state, and DNS instruction generation.
3. Domain registry collection, `tenant_domains`, used as the source of truth for custom host routing.
4. Request proxy/middleware that resolves platform hosts, tenant subdomains, and registered custom domains before application code runs.

## Database Schema

`labs`

```json
{
  "_id": "ObjectId",
  "name": "Uthiram Lab",
  "tenantId": "uthiram-lab",
  "dbName": "tenant_uthiram_lab",
  "status": "active"
}
```

`tenant_domains`

```json
{
  "_id": "ObjectId",
  "tenantId": "uthiram-lab",
  "lab": "ObjectId",
  "domain": "uthiram.in",
  "isPrimary": true,
  "status": "active",
  "dnsVerified": true,
  "sslIssued": true,
  "configured": true,
  "verified": true,
  "dnsStatus": "configured",
  "sslStatus": "issued",
  "vercelDomainId": "uthiram.in",
  "vercelProjectId": "vercel_project_id",
  "dnsRecords": [],
  "lastCheckedAt": "ISODate",
  "lastVerifiedAt": "ISODate",
  "createdAt": "ISODate"
}
```

Indexes:

- Unique `domain`
- Unique partial `{ tenantId, isPrimary: true }`
- `{ status, updatedAt }` for background verification scans
- `{ dnsVerified, sslIssued, updatedAt }` for SSL monitoring scans

## API Endpoints

Developer tenant-domain route:

- `GET /api/developer/labs/:tenantId/domains`
- `POST /api/developer/labs/:tenantId/domains`
- `PATCH /api/developer/labs/:tenantId/domains`
- `DELETE /api/developer/labs/:tenantId/domains?domain=uthiram.in`

PATCH actions:

```json
{ "action": "verify", "domainName": "uthiram.in" }
{ "action": "set-primary", "domainName": "uthiram.in" }
```

Internal tenant lookup:

- `GET /api/internal/tenant?domain=uthiram.in`
- Protected by `TENANT_LOOKUP_SECRET`
- Returns only public tenant routing metadata

## Vercel API Integration

Environment variables:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID` optional
- `ROOT_DOMAIN=lims.store`

Flow:

1. User submits `uthiram.in`.
2. System validates format, platform-domain reservation, and duplicate ownership.
3. System calls Vercel `POST /v10/projects/{projectId}/domains`.
4. System stores Vercel response, verification records, DNS routing records, and lifecycle status.
5. User creates DNS records at GoDaddy, BigRock, Namecheap, or Cloudflare.
6. Verify action calls Vercel project-domain APIs and updates DNS/SSL status.
7. Background verification continues polling pending domains until active or failed.

## DNS Instructions

Required records:

| Type | Host | Value |
| --- | --- | --- |
| TXT | Vercel-provided verification host, or `_lims-verify.domain` fallback | verification token |
| A | `@` for apex domains | `76.76.21.21` |
| CNAME | subdomain host | `cname.vercel-dns.com` |

Optional records:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `www` | `cname.vercel-dns.com` |

Provider UX should show the same records with provider-specific labels:

- GoDaddy: Name = `@`, `_lims-verify`, `www`
- BigRock: Host = `@`, `_lims-verify`, `www`
- Namecheap: Host = `@`, `_lims-verify`, `www`
- Cloudflare: Name = `@`, `_lims-verify`, `www`; CNAME should be DNS-only during setup if proxying blocks verification

## Lifecycle

```text
pending
  -> added_to_vercel
  -> waiting_dns
  -> dns_verified
  -> ssl_provisioning
  -> active
```

Failure states:

- `failed`: Vercel verification failed, DNS is incorrect, or SSL failed
- `removing`: domain is being detached from Vercel and deleted locally

## Middleware Strategy

Request handling:

1. Strip client-supplied tenant headers.
2. Detect platform domain: `lims.store`, `www.lims.store`, `developer.lims.store`.
3. Detect tenant subdomain: `uthiram-lab.lims.store`.
4. Detect custom domain: `uthiram.in`.
5. Resolve custom domain through `tenant_domains.domain`.
6. Require domain status `active`, `dnsVerified=true`, `sslIssued=true`.
7. Inject trusted `x-lims-tenant-id`.
8. Tenant APIs compare resolved tenant against the signed session tenant.

Unregistered custom domains return `404 Domain Not Registered`.

## Background Jobs

Use a scheduled endpoint or worker:

- `domain-verification-worker`: scans `waiting_dns`, `dns_verified`, and `ssl_provisioning`.
- `ssl-monitor-worker`: scans active domains daily and downgrades failed/expired SSL.
- `domain-cleanup-worker`: retries Vercel deletion for domains stuck in `removing`.

Recommended schedule:

- Pending verification: every 5 minutes
- SSL monitoring: every 6 hours
- Cleanup: every hour

On Vercel, use Vercel Cron or an external worker queue. For thousands of domains, process in small batches with backoff and Vercel API rate-limit handling.

## Security

- Only developer owner users can manage custom domains.
- Domains are globally unique.
- Platform domains and reserved hostnames cannot be registered as tenant domains.
- Tenant request context is injected only by middleware/proxy.
- User-supplied tenant headers are stripped before routing.
- Tenant sessions must match resolved tenant IDs.
- Vercel tokens remain server-side only.
- Store only public DNS instructions in responses; hide internal secrets.
- Log all add, verify, primary-change, and remove actions.

## Error Handling

Return clear states:

- `400`: invalid domain or reserved domain
- `409`: domain already owned or cannot set inactive domain primary
- `424`: Vercel added domain but DNS is pending
- `502`: Vercel API unavailable
- `404`: domain/lab not found

Persist `lastError` on the domain record for operator visibility.

## Deployment Plan

1. Set `ROOT_DOMAIN=lims.store`.
2. Set `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and optional `VERCEL_TEAM_ID`.
3. Deploy the updated Next.js project.
4. Create MongoDB indexes for `tenant_domains`.
5. Run a migration from old embedded `Lab.customDomains` into `tenant_domains` if needed.
6. Enable Vercel Cron or an external worker for verification and SSL monitoring.
7. Test with a disposable domain before production onboarding.

## Current Implementation Files

- `src/app/models/master/TenantDomain.js`
- `src/app/lib/vercel-domains.js`
- `src/app/lib/domain-management.js`
- `src/app/api/developer/labs/[tenantId]/domains/route.js`
- `src/app/lib/tenant-cache.js`
- `src/proxy.js`
- `src/app/developer/labs/[id]/domains/page.js`
