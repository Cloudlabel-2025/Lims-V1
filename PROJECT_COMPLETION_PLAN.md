# LIMS Full System Completion Plan

This project is now being completed as a multi-tenant LIMS platform. The foundation is master DB plus tenant DB, secure cookie auth, RBAC permissions, tenant-scoped APIs, and lab-specific branding.

## 1. Core Platform
- Complete master DB and tenant DB separation.
- Keep tenant IDs resolved from session, subdomain, or approved local fallback.
- Add shared audit logging for create/update/delete/security events.
- Add deployment-safe environment validation.

## 2. Authentication
- Use `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` from the UI.
- Remove all fake login and guest bypasses.
- Complete forgot/reset password screens.
- Add developer-owner and tenant-user UX differences.

## 3. Lab Onboarding
- Seed RBAC catalog with `scripts/seed-rbac.mjs`.
- Seed developer owner with `scripts/seed-developer-owner.mjs`.
- Onboard labs with `scripts/onboard-lab.mjs`.
- Add developer UI for lab creation, suspension, plan changes, and admin reset.

## 4. Patient Module
- Finish registration, list/search, detail, edit, delete, duplicate handling, and visit history.
- Enforce `patients.*` permissions on all patient APIs.
- Add complete validation and tenant-safe numbering.

## 5. Doctor Module
- Finish registration, list/search, detail, edit, delete, referral/investor categorization.
- Link doctors to patients, orders, billing, reports, and analytics.

## 6. Test Catalog
- Add test master, departments, profiles/packages, sample type, units, method, price, and normal ranges.
- Add plan/role restrictions where required.

## 7. Orders
- Add order creation for one patient with multiple tests.
- Add status workflow, urgency, referral doctor, cancellation, and order history.

## 8. Samples
- Add sample collection, barcode/sample IDs, processing status, rejection workflow, and collector details.

## 9. Reports
- Add result entry, verification, release, print/download PDF, report templates, and digital signature support.

## 10. Billing And Accounts
- Add invoices from orders, discounts, payments, dues, refunds, daily close, ledgers, and account reports.

## 11. Inventory
- Add reagent/consumable master, stock in/out, expiry tracking, low-stock alerts, and test usage linkage.

## 12. Quality Control
- Add QC logs, calibration records, corrective actions, events, and audit trail.

## 13. Dashboard And Analytics
- Add real dashboard widgets for pending samples, orders, reports, revenue, doctor referrals, and trends.
- Add developer platform dashboard for all tenant labs.

## 14. Admin Settings
- Add tenant user management, role assignment, lab profile, numbering formats, and report settings.

## 15. Security
- Enforce session and RBAC on every protected API.
- Prevent tenant spoofing by matching route/header tenant to session tenant.
- Rate-limit auth endpoints.
- Hide sensitive fields such as tenant DB connection strings.

## 16. UI Completion
- Replace demo screens with real workflows.
- Add empty, loading, error, and unauthorized states.
- Finish responsive behavior across desktop and mobile.

## 17. Testing And Deployment
- Fix lint and build.
- Add API tests for auth, tenant isolation, RBAC, patients, and doctors.
- Add seed/onboarding/deployment docs.
- Add backup and restore strategy for tenant DBs.

## 18. Dynamic Lab Theme And Branding
- Store branding in the master `Lab` record.
- Load tenant theme through `/api/theme`.
- Apply primary, secondary, and accent colors using CSS variables.
- Use lab display name/logo across login, dashboard, reports, and print templates.
- Add admin/developer UI to update branding safely.
