# Subscription Management — Phase 1 Implementation

## Outcome

Phase 1 adds a backward-compatible subscription and quota foundation to the existing LIMS. It runs exclusively in `shadow` enforcement mode: patient registrations and confirmed bills are measured, but no laboratory operation is blocked.

## Implemented

- Dynamic master-database subscription packages with immutable versions.
- Default Basic, Standard, and Premium v1 definitions.
- Separate lab subscription assignments with entitlement snapshots.
- Legacy plan mapping: Basic → Basic, Professional/Trial → Standard, Enterprise → Premium.
- Subscription states separate from lab operational states.
- Explicit `off`, `shadow`, and future `hard` enforcement modes.
- Tenant-local monthly quota periods.
- Immutable, idempotent quota usage events.
- Patient registration measurement in the same tenant transaction as patient creation.
- Confirmed billing measurement in the same tenant transaction as invoice creation.
- Staff-user count visibility on the developer usage page.
- Developer-only package API and per-lab subscription/usage API.
- Developer UI at `/developer/labs/{tenantId}/subscription`.
- Seed and migration command for existing labs and tenant quota indexes.
- Fail-closed validation for unknown commercial module permissions.

## Default allowances

| Package | Patients/month | Confirmed bills/month | Active staff |
|---|---:|---:|---:|
| Basic | 250 | 500 | 5 |
| Standard | 1,000 | 2,500 | 20 |
| Premium | 5,000 | 10,000 | 75 |

These are version-1 seed values and should be commercially reviewed before production enforcement.

## Data placement

Master database:

- `SubscriptionPackage`
- `LabSubscription`

Each tenant database:

- `QuotaPeriod`
- `QuotaUsageEvent`

The tenant database is authoritative for real-time usage because its quota update is committed in the same transaction as the patient or bill.

## Seed and migrate

Review `.env.local` and make sure it points to the intended environment before running this write operation:

```powershell
npm.cmd run seed:subscriptions
```

The command:

1. Creates Basic, Standard, and Premium if missing.
2. Preserves existing package versions.
3. Creates one shadow subscription for each existing non-deleted lab if missing.
4. Preserves each lab's existing enabled-module overrides.
5. Initializes quota indexes in active tenant databases.

The command is idempotent and does not enable hard enforcement.

## Manual testing flow

### 1. Baseline

1. Run `npm.cmd run seed:subscriptions` against a development database.
2. Start the application with `npm.cmd run dev`.
3. Sign in as the developer owner.
4. Open **Developer → Labs**.
5. Select **Usage** for an active lab.
6. Confirm package, version, `shadow` mode, usage-period dates, modules, features, and zero or current counters.

### 2. Patient measurement

1. Sign in to that tenant lab.
2. Register one valid new patient.
3. Return to the developer Usage page and refresh.
4. Confirm Patient registrations increased by exactly one.
5. Submit an invalid patient and confirm usage does not change.
6. Edit an existing patient and confirm usage does not change.
7. Submit a duplicate that is rejected and confirm usage does not change.

### 3. Billing measurement

1. Create and confirm one valid bill for a patient.
2. Refresh the developer Usage page.
3. Confirm Confirmed bills increased by exactly one.
4. Trigger a billing validation failure and confirm usage does not change.
5. Confirm the usage event references the BillingRecord and the actor email.

### 4. Shadow over-limit behavior

In a disposable development database, lower the current tenant `QuotaPeriod.quotas.patientRegistrations.included` to the current consumed value. Register another patient.

Expected:

- The patient is still created.
- Usage increases.
- `wouldBlockAttempts` increases.
- The event type is `would-block`.
- The developer page shows **Would be blocked in hard mode**.

Do not perform this quota edit against production data.

### 5. Idempotency and rollback

1. Verify one patient has one `patient-registration:{patientId}` event.
2. Verify one bill has one `billing-confirmed:{billingRecordId}` event.
3. Force a tenant transaction failure in a development environment and confirm neither the domain record nor its quota event/counter is committed.

## Automated verification

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## Phase 2 plan

Phase 2 turns measurements into a customer-ready quota experience while remaining independent of the future public subscription website.

1. Add hard-mode quota reservation and standardized quota-exceeded responses.
2. Add tenant-owner usage cards and 70/85/95/100 percent warnings.
3. Preserve patient/billing form data when a quota operation is refused.
4. Add developer package/version creation and publishing UI.
5. Add audited package assignment, upgrades, scheduled downgrades, and manual adjustments.
6. Add prepaid patient and billing add-on products and idempotent quota grants.
7. Add email/in-app limit notifications.
8. Add subscription grace-period policies and read-only/restricted behavior.
9. Add usage reconciliation and operational dashboards.
10. Run shadow-versus-actual comparisons before enabling hard mode for selected pilot labs.

Payment gateway integration, public signup, the customer billing portal, and automated paid provisioning remain Phase 3 work after Phase 2 quota enforcement is proven.
