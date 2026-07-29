# Current System Document: Multi-Tenant LIMS SaaS Platform

Prepared: 27 July 2026  
System: LIMS Core  
Repository reviewed: `D:\LIMS\Lims`

## 1. Executive Summary

LIMS Core is a multi-tenant Laboratory Information Management System designed for diagnostic laboratories, pathology labs, collection centers, referral networks, and lab groups that need an integrated operational and financial platform. The product is built as a SaaS-ready web application using Next.js, React, MongoDB, secure cookie sessions, tenant-scoped databases, and role-based access control.

The current system already contains the foundation needed for a commercial LIMS platform: lab onboarding, tenant isolation, authentication, RBAC, patients, doctors, test master, billing, samples, reports, accounts, corporate accounts, expenses, inventory, analytics, audit view, search, notifications, doctor portal, and patient portal. Billing is intentionally treated as the central front-desk transaction module, and downstream workflows such as samples, reports, payments, receipts, accounts, commissions, and patient/doctor visibility connect back to the `BillingRecord`.

The product direction is strong because it solves a real operating gap in small and mid-sized laboratories: most labs need more than billing software, but full enterprise LIMS products are often costly, complex, and slow to deploy. LIMS Core targets that middle segment with a practical SaaS model, fast onboarding, modular pricing, local workflow support, and a path toward digital health interoperability.

The current build is not yet production-complete. The strongest completed areas are the multi-tenant architecture, authentication, password reset flow, API error handling, RBAC catalog, lab module structure, patient and doctor records, billing foundation, sample/report structures, accounts pages, and portal flows. The highest-priority gaps are soft delete and recovery, complete audit logging across all sensitive actions, report PDF/branding/signature polish, settlement/reconciliation completion, runtime subscription enforcement, automated tests, backup/restore, deployment checklist, and production support tooling.

This document gives the current business, product, and system position. The companion plan document, `PROPER_SYSTEM_PLAN_DOCUMENT.md`, converts this current state into an execution roadmap.

## 2. Problem Statement

Diagnostic laboratories handle sensitive, fast-moving workflows where a single patient visit may involve registration, referral doctor selection, test selection, billing, payment collection, sample collection, barcode handling, result entry, pathologist approval, report release, print/download, doctor commission, account posting, and patient access.

Many small and mid-sized labs still operate with fragmented tools: spreadsheets for expenses, paper slips for samples, separate accounting records, manual doctor commission tracking, inconsistent report templates, and limited patient communication. Even when software is used, it is often built around billing only and does not fully control sample traceability, reporting, auditability, role permissions, or multi-branch SaaS operations.

The key problems are:

- Patient, billing, sample, and report data are often disconnected.
- Labs lack reliable workflow status visibility from bill creation to report release.
- Manual doctor commission tracking creates disputes and accounting leakage.
- Staff permissions are often too broad, increasing the risk of data misuse or billing manipulation.
- Owners have limited visibility into dues, revenue, expenses, inventory, and referral trends.
- Patients and doctors expect digital access to reports, but labs often share PDFs manually.
- Lab groups and SaaS providers need tenant isolation, onboarding tools, and subscription control.
- Production compliance requires audit trails, data recovery, secure authentication, and controlled deletion.

LIMS Core addresses these by providing a single tenant-aware platform where operational, reporting, financial, and access workflows can be governed together.

## 3. Product / Solution Overview

LIMS Core is a SaaS-ready laboratory management platform. It is built for a platform owner who can onboard multiple independent laboratory tenants. Each lab can have its own users, roles, settings, branding, enabled modules, records, and database boundary.

The system has three major layers:

- Platform layer: developer/admin users manage labs, tenant status, access reset, permissions, role templates, and lab lifecycle.
- Tenant lab layer: each laboratory uses the dashboard, patients, doctors, tests, billing, samples, reports, accounts, inventory, analytics, audit, and settings modules.
- External access layer: doctors and patients access controlled portals with server-side ownership checks and released-report-only visibility.

The current technical stack is:

- Next.js 16 and React 19 for the web application.
- MongoDB with Mongoose models for master and tenant data.
- Secure cookie-based sessions.
- RBAC configuration with permission dependencies, dangerous actions, and plan-aware permission metadata.
- PDF, QR code, Excel, Cloudinary, and email-related libraries for operational outputs and uploads.
- Node test runner for unit and smoke tests.

The product should be positioned as a practical, modular LIMS SaaS for diagnostic labs that want controlled workflows without enterprise implementation complexity.

## 4. Market Analysis

The global market context is favorable. Published 2026 market research estimates differ by methodology, but all show growing demand for laboratory software and digital lab operations. Fortune Business Insights estimated the global LIMS market at USD 1.48 billion in 2025 and projected growth to USD 2.53 billion by 2034 at a 6.47% CAGR. Grand View Research estimated the LIMS market at USD 2.1 billion in 2025 and projected USD 3.5 billion by 2033 at a 6.6% CAGR. A 2026 MarketsandMarkets release projected a higher LIMS trajectory, from USD 2.88 billion in 2025 to USD 5.19 billion by 2030 at a 12.5% CAGR.

The broader clinical laboratory services market is also large. Grand View Research estimated global clinical laboratory services at USD 224.4 billion in 2025 and projected USD 308.2 billion by 2033. This matters because LIMS adoption follows the operational digitization of the labs delivering those services.

India is especially relevant for this product because diagnostic centers, clinics, hospitals, and laboratories are being pulled toward digital records and interoperability. The Ayushman Bharat Digital Mission describes a national digital health ecosystem with open, interoperable standards and patient-controlled digital health records. The ABDM Digital Health Incentive Scheme has explicitly referred to Laboratory Management Information System solutions and diagnostics centers as part of the digital health ecosystem.

Target customer segments:

- Independent pathology labs with 1 to 5 locations.
- Mid-sized diagnostic chains with multiple branches and collection centers.
- Hospital-attached laboratories that need tighter sample/report/account workflows.
- Referral-heavy labs that need doctor commission tracking.
- Corporate health checkup and camp-focused labs needing statement billing.
- New diagnostic startups that want SaaS onboarding instead of custom implementation.
- Platform owners who want to sell LIMS subscriptions to regional labs.

Primary geographic focus:

- India tier 1, tier 2, and tier 3 cities.
- GCC and South Asian markets with similar diagnostic lab operating patterns.
- English-speaking emerging markets where cloud deployment and lower-cost SaaS are attractive.

Demand drivers:

- Need for faster patient registration and billing.
- Growing expectation of online report access.
- Increasing diagnostic volumes.
- Lab owner demand for financial visibility.
- Referral and commission complexity.
- Regulatory pressure toward auditability and secure data handling.
- Digital health ecosystem adoption.
- Need to reduce manual errors in sample and report workflows.

Market positioning:

LIMS Core should not compete first as a heavy enterprise laboratory informatics suite for pharmaceutical research labs. It should compete as an operations-first diagnostic LIMS SaaS for clinical labs that need billing, samples, reports, accounts, portals, and multi-tenant management in one platform.

## 5. Current Architecture

The architecture is built around master and tenant separation.

Master database responsibilities:

- Platform labs.
- Developer users.
- Master permission catalog.
- Tenant role templates.
- Lab branding, plan, status, and module configuration.

Tenant database responsibilities:

- Tenant users and roles.
- Patients and patient portal accounts.
- Doctors and linked doctor users.
- Test categories, definitions, and packages.
- Billing records and payment receipts.
- Samples and reports.
- Accounts, journal entries, expenses, corporate accounts.
- Inventory entities.
- Audit logs.

Key architectural files:

- `src/app/lib/master-db.js`
- `src/app/lib/tenant-db.js`
- `src/app/lib/tenant-resolver.js`
- `src/app/lib/tenant-provisioning.js`
- `src/app/lib/session.js`
- `src/app/lib/auth.js`
- `src/app/lib/rbac.js`
- `src/app/lib/rbac-config.json`
- `src/app/lib/modules.js`

The core SaaS architecture is sound. The remaining production work is less about changing the architecture and more about completing operational controls: audit coverage, plan enforcement, environment validation, backups, restore flows, and strict data lifecycle handling.

## 6. Features & Modules Breakdown

### 6.1 Platform / Developer Admin

Purpose: Manage the SaaS platform and tenant labs.

Current capabilities:

- Developer dashboard.
- Lab listing, create, edit, archived, and deleted lab pages.
- Lab access reset route.
- Lab plan and enabled-module fields.
- Master permission catalog and role templates.
- Lab branding/theme direction.

Business value:

The platform owner can onboard and manage multiple labs from one product instead of deploying separate custom instances.

Current gaps:

- Stronger platform audit.
- Subscription enforcement at runtime.
- Lab archive, recovery, and permanent deletion controls.
- Backup/restore operations.
- Production support dashboard.

### 6.2 Authentication & Session

Purpose: Secure login, logout, current user lookup, password reset, and tenant-aware sessions.

Current capabilities:

- Login, logout, and current user APIs.
- Forgot password and reset password flow.
- Strong password validation through shared helpers.
- Secure session handling.
- Malformed session hardening.
- Production-safe API error helper.
- Developer and tenant user distinction.

Current gaps:

- Broader rate limiting coverage.
- Security event audit coverage.
- Session monitoring and suspicious activity reporting.
- Optional MFA for admin/pathologist/accounts roles.

### 6.3 RBAC / Users / Settings

Purpose: Give every lab role-based control over who can view, create, edit, delete, collect, refund, verify, release, print, and manage settings.

Current capabilities:

- Permission catalog.
- Role templates including Admin, Lab Manager, Technician, Phlebotomist, Report Typist, Pathologist, Front Desk, Billing Cashier, Accounts Manager, Doctor Investor, Doctor Regular, and Inventory Manager.
- Permission dependencies.
- Dangerous permission flags.
- Plan-aware metadata.
- Settings pages for users, roles, and permission matrix.

Current gaps:

- Full runtime enforcement for subscription plan limits.
- Audit logs for every role and permission change.
- Approval flow for dangerous permission grants.

### 6.4 Dashboard

Purpose: Give staff and owners quick visibility into operational and financial status.

Current capabilities:

- Tenant dashboard page.
- Stats API.
- Permission-aware summary direction.
- Current UI labels for patients, samples, reports, and operational counts.

Current gaps:

- Deeper widgets for pending samples, pending reports, revenue trends, doctor referrals, urgent work, and daily performance.
- Role-specific dashboards for front desk, technician, pathologist, accounts, and owner.

### 6.5 Patient Module

Purpose: Maintain patient identity and history.

Current capabilities:

- Patient registration.
- Patient list/table/grid.
- Patient sidebar.
- Edit patient.
- Visit history.
- New visit page.
- Portal access page.
- Patient billing lookup API.
- Duplicate phone warning direction.
- Patient portal account support.

Business value:

This reduces duplicate records, improves repeat visit handling, and links patient identity to bills, samples, reports, and portal access.

Current gaps:

- Soft delete and restore.
- Deletion protection when linked bills/reports exist.
- Stronger duplicate detection.
- Full audit logging.
- Cleaner separation between pure registration and billing/order creation.

### 6.6 Doctor Module

Purpose: Manage referral doctors, doctor users, commissions, and doctor portal access.

Current capabilities:

- Doctor registration, list, grid/table, sidebar, edit.
- Doctor profile and self-profile.
- Commission fields and pending payout.
- Doctor invitation and resend invitation route.
- Doctor portal dashboard and patient detail flow.
- Doctor payout API.
- Server-side doctor ownership checks.

Business value:

The module supports referral relationships, commission transparency, and doctor-facing access to referred patient reports.

Current gaps:

- Soft delete and restore.
- Detailed doctor statement and performance dashboard.
- Commission approval and payout history polish.
- Audit logs for doctor profile, invitation, and commission events.

### 6.7 Test Master

Purpose: Maintain categories, test definitions, parameters, packages, sample requirements, price, and inventory linkage.

Current capabilities:

- Test category APIs and UI tab.
- Test definition APIs and UI tab.
- Package APIs and UI tab.
- Parameters and normal range direction.
- Price permission checks.
- Inventory item requirement fields.

Current gaps:

- Production workflow polish for deactivate/restore.
- Advanced reference ranges by age/sex/context.
- Stronger package validation.
- Report template dependency mapping.
- Complete audit trail.

### 6.8 Billing

Purpose: Main front-desk transaction module for investigations, payments, settlement, invoices, receipts, and workflow state.

Current capabilities:

- Bill creation page and history tab.
- Patient and test/package selection direction.
- Billing model with `billId`.
- Payment status and settlement modal.
- Payment history modal.
- Invoice and receipt APIs.
- Billing update/cancel route.
- Corporate payment mode support direction.
- Doctor referral commission linkage.

Business value:

Billing is the operational anchor. It controls revenue capture and connects patient activity to samples, reports, accounts, corporate receivables, and commissions.

Current gaps:

- Refund flow polish.
- Stronger cancellation controls.
- Daily close and reconciliation.
- Audit logging for collection, settlement, cancellation, discount, and refund.
- Optional separation of order and invoice concepts if future workflows require it.

### 6.9 Sample Management

Purpose: Track samples from registration and collection through processing, rejection, completion, and reporting.

Current capabilities:

- Sample model.
- Sample page and register page.
- Sample wizard with detail, result, and review steps.
- Sample APIs.
- Barcode endpoint.
- Status and custody-related fields.
- Inventory reservation direction.

Current gaps:

- Barcode printing/scanning workflow.
- Stronger rejection approval.
- Complete collection UX.
- Automatic inventory consumption.
- Archive/restore controls.
- Audit logging.

### 6.10 Report Management

Purpose: Enter, review, approve, release, print, and track lab reports.

Current capabilities:

- Report list, entry panel, preview, and detail page.
- Report APIs.
- Test report model.
- Result parameter structure.
- Review/approve/release status direction.
- Previous version history direction.
- Released-report-only portal access.

Current gaps:

- Final branded PDF output.
- Digital signature.
- Template expansion.
- Correction approval flow.
- Release restrictions polish.
- Audit logging for result edit, verification, approval, release, and correction.

### 6.11 Accounts

Purpose: Track financial records, ledgers, receipts, invoices, journal entries, expenses, P&L, dues, and reporting.

Current capabilities:

- Accounts dashboard and pages for chart, ledger, receipts, invoices, manual journal, P&L, reports, expenses, corporate accounts, and commissions.
- Accounting APIs for accounts, journal entries, receipts, P&L, daily collection, weekly report, monthly revenue, income-expense, outstanding, commissions, dashboard, and consolidated reports.
- PDF and Excel export helpers.

Current gaps:

- Daily close workflow completion.
- Reconciliation and settlement approval.
- Advanced export polish.
- Audit logging.
- Accountant approval flow.

### 6.12 Corporate Accounts

Purpose: Manage companies, camps, clinics, and institutions that need credit or statement billing.

Current capabilities:

- Corporate account model.
- Corporate APIs.
- Corporate account page.
- Statement API.
- Billing link direction.

Current gaps:

- Corporate settlement workflow.
- Aging report.
- Credit-limit alerts.
- Statement PDF/export.
- Audit logging.

### 6.13 Expenses

Purpose: Record and categorize lab expenses.

Current capabilities:

- Expense category and entry models.
- Expenses APIs.
- Expenses page.
- Accounting report connection.

Current gaps:

- Approval workflow.
- Attachments.
- Recurring expenses.
- Export and deletion recovery.
- Audit logging.

### 6.14 Doctor Commission / Payout

Purpose: Calculate and settle referral commissions.

Current capabilities:

- Doctor commission percentage.
- Pending payout.
- Billing commission linkage.
- Commission report route.
- Doctor payout API.
- Accounts commission page.
- Export helpers.

Current gaps:

- Detailed payout statements.
- Approval workflow.
- Paid/unpaid history UI.
- Doctor-wise commission dashboard.
- Audit trail.

### 6.15 Inventory

Purpose: Manage reagents, consumables, stock, suppliers, locations, purchase orders, movements, expiry, and imports/exports.

Current capabilities:

- Inventory item, category, type, location, movement, purchase order, supplier, storage condition, and UOM models.
- Inventory page.
- APIs for items, import/export, locations, movements, purchase orders, storage conditions, suppliers, types, UOMs.
- Expiry helper.

Current gaps:

- Low-stock alert workflow.
- Automatic consumption during sample/report processing.
- Expiry dashboard.
- Purchase approval.
- Wastage tracking.
- Audit logging.

### 6.16 Analytics

Purpose: Provide business and operational insight.

Current capabilities:

- Analytics page and API.
- Revenue and permission-aware commission visibility direction.
- Plan-based availability direction.

Current gaps:

- Deeper charts and comparisons.
- Doctor-wise dashboards.
- Test-wise revenue.
- Pending workflow analytics.
- Exportable analytics.

### 6.17 Audit

Purpose: Record who did what, when, and why.

Current capabilities:

- Audit log model.
- Audit page and API.
- Tenant-level audit structure.
- Permission-based viewing.

Current gaps:

- Shared audit helper usage across all important actions.
- Developer audit events.
- Export.
- Filters and retention policy.

### 6.18 Search & Notifications

Purpose: Help users quickly find records and see alerts.

Current capabilities:

- Search scopes for patients, doctors, tests, samples, and reports.
- Notification rules for inactive doctors, sample inventory low, and pending reports.
- Permission-aware visibility direction.

Current gaps:

- Real-time alerts.
- Read/unread state.
- User-specific preferences.
- Advanced search filters.

### 6.19 Patient Portal

Purpose: Give patients safe access to released reports and bill information.

Current capabilities:

- QR/PIN activation flow.
- Separate patient cookie and auth scope.
- One-time activation token hashed with SHA-256.
- Portal PIN hashed with salted scrypt.
- DOB verification.
- Rate limits and lockout.
- Released reports only.
- Patient-safe bill fields only.
- `private, no-store` medical data responses.

Current gaps:

- Production design polish.
- Optional WhatsApp/SMS/email delivery integrations.
- Consent and ABDM-style interoperability roadmap.

### 6.20 Doctor Portal

Purpose: Give referring doctors controlled access to their referred patient reports and commission information.

Current capabilities:

- Doctor activation by email OTP.
- Linked tenant `User.doctorId`.
- Portal dashboard.
- Referred patient list and details.
- Released report visibility only.
- Commission and payout visibility direction.
- Server-side ownership checks.

Current gaps:

- Statement export.
- Enhanced referral performance analytics.
- Email change verification workflow.
- Stronger portal-specific audit and notification flows.

## 7. Business Model

Recommended SaaS model:

- Basic: For small labs needing patients, doctors, tests, billing, samples, reports, and basic dashboard.
- Professional: Adds accounts, analytics, inventory, advanced RBAC, report branding, doctor portal, patient portal, and exports.
- Enterprise: Adds multi-branch controls, corporate accounts, advanced audit, backup/restore support, custom branding, priority support, API integrations, and higher limits.

Possible pricing strategy for India:

- Starter implementation fee for data setup, branding, and training.
- Monthly subscription per lab or branch.
- Optional user/volume tiers based on reports per month.
- Optional add-ons for WhatsApp/SMS, custom report templates, ABDM integration, multi-location consolidation, and migration.
- Annual plan discount to improve cash flow.

Pricing should remain simple enough for small labs to understand. Avoid charging separately for every tiny workflow early; use clear module bundles and support plans.

Revenue streams:

- SaaS subscription.
- Onboarding and data migration.
- Custom report template design.
- Integration services.
- Premium support.
- Training packages.
- White-label platform licensing for regional distributors.

## 8. Competitive Advantage

LIMS Core can win through focus, workflow fit, and SaaS architecture.

Core advantages:

- Multi-tenant by design, not retrofitted.
- Billing-centered lab workflow that matches how many diagnostic labs actually operate.
- Integrated patient, doctor, sample, report, billing, accounts, and inventory modules.
- Doctor portal and patient portal already designed around safe released-report-only access.
- RBAC with dangerous permissions and plan-aware metadata.
- Referral commission and payout tracking.
- Corporate accounts and statement direction.
- Inventory and expiry direction for reagents and consumables.
- SaaS platform admin for lab onboarding and lifecycle.
- Built with modern web stack and MongoDB tenant boundaries.

Differentiation against billing-only tools:

- Better sample/report traceability.
- Role-based control.
- Audit direction.
- Accounts and commission linkage.
- Patient and doctor portals.

Differentiation against enterprise LIMS:

- Faster implementation.
- Lower operational complexity.
- More practical fit for small and mid-sized diagnostics.
- Modular SaaS pricing.
- Easier customization for regional workflows.

## 9. Go-To-Market Strategy

Primary GTM motion:

Start with direct sales to independent labs and small diagnostic chains in one region, then expand through referrals, implementation partners, and lab software resellers.

Ideal first customers:

- Labs using spreadsheets or billing-only software.
- Labs with high referral doctor volume.
- Labs with 1 to 3 branches.
- Labs that want patient report access without building a portal.
- Labs needing better dues, commission, and expense visibility.

Sales messages:

- "Run billing, samples, reports, accounts, inventory, and portals in one system."
- "Give patients and doctors secure report access."
- "Track dues, commissions, expenses, and daily collections."
- "Protect lab data with user roles, audit, and tenant isolation."
- "Launch quickly with cloud deployment and guided onboarding."

Marketing channels:

- Founder-led demos.
- WhatsApp and phone outreach to local labs.
- Partnerships with diagnostic equipment suppliers and lab consultants.
- Case studies from first 3 to 5 labs.
- Local medical/lab association events.
- LinkedIn content for diagnostic owners and healthcare IT buyers.
- Regional language demo videos.

Sales process:

1. Discovery call.
2. Workflow mapping.
3. Demo using lab-specific scenario.
4. Trial or pilot with limited records.
5. Data setup and training.
6. Go-live with support.
7. Monthly success review.

## 10. Implementation Strategy

Deployment model:

- Cloud-hosted SaaS with one application instance serving many tenants.
- Master DB stores platform metadata.
- Each tenant lab uses tenant-scoped database/model access.
- Tenant resolved from session, subdomain, or approved local fallback.
- Lab branding loaded through theme API.

Implementation stages for a new lab:

1. Create lab from developer admin.
2. Configure branding, plan, enabled modules, and tenant connection.
3. Seed role templates and create initial admin.
4. Configure users and roles.
5. Load test categories, tests, packages, and pricing.
6. Load doctors and commission settings.
7. Configure report template and signature.
8. Train front desk, technician, pathologist, accounts, and admin users.
9. Run pilot with limited live records.
10. Migrate opening balances, corporate clients, inventory stock, and pending dues.
11. Go live.
12. Monitor daily for first week.

Production readiness requirements:

- Environment validation.
- Secure secrets.
- Database backup and restore procedure.
- Audit logging on sensitive actions.
- Soft delete and recovery.
- Build, lint, and automated test checks.
- Log and error monitoring.
- Admin support runbook.
- Data retention policy.

## 11. Risk Analysis

### Product Risk

Risk: The product has many modules, and incomplete workflows can reduce buyer confidence.

Mitigation: Complete the core revenue workflow first: patient, doctor, test master, billing, sample, report, payment, receipt, and accounts posting. Keep future modules behind plan/module flags until polished.

### Compliance / Data Risk

Risk: Patient records and reports are sensitive medical data.

Mitigation: Enforce tenant isolation, secure sessions, RBAC, no-store responses, audit logs, backup/restore, soft delete, and least-privilege access.

### Operational Risk

Risk: Labs depend on the system during peak hours.

Mitigation: Improve test coverage, deployment checklist, monitoring, database indexes, backup strategy, and rollback procedure.

### Financial Risk

Risk: Billing, dues, refunds, discounts, and commissions can create disputes.

Mitigation: Add audit logging, settlement history, refund approvals, daily close, and reconciliation reports.

### Adoption Risk

Risk: Staff may resist a more controlled workflow.

Mitigation: Keep the UI workflow practical, train by role, and use simple screens for front desk and sample collection.

### Market Risk

Risk: Existing local vendors may compete on price.

Mitigation: Sell integrated workflow value, portals, accounts, auditability, and SaaS support instead of only low price.

## 12. Future Roadmap

Near-term roadmap:

- Complete soft delete and recovery.
- Complete report PDF, branding, and signature.
- Complete billing settlement, refund, and daily close controls.
- Apply shared audit logging across sensitive actions.
- Strengthen test coverage and deployment readiness.

Mid-term roadmap:

- Advanced analytics.
- Corporate settlement and aging.
- Inventory consumption automation.
- Patient and doctor communication integrations.
- Multi-branch consolidation.
- Improved support tools.

Long-term roadmap:

- ABDM integration direction.
- API marketplace for integrations.
- AI-assisted report review flags and operational insights.
- White-label partner platform.
- Regional language portals.
- Instrument integration where commercially justified.

## 13. Current System Conclusion

LIMS Core has a serious product foundation. It is not just a prototype landing page or a billing screen; it already has the shape of a full diagnostic lab operating system. The current priority should be to stop expanding breadth and finish production reliability around the core workflow.

The system should be presented to investors or clients as:

"A SaaS-ready, multi-tenant diagnostic LIMS platform for labs that need integrated billing, samples, reports, accounts, inventory, doctor referrals, and patient/doctor portals."

The product is commercially promising if the next phase focuses on trust-building features: audit logs, recovery, report output, financial reconciliation, testing, deployment, and support process.

## 14. Source Notes

Market references used for this document:

- Fortune Business Insights, Laboratory Information Management System Market, last updated 6 July 2026: https://www.fortunebusinessinsights.com/laboratory-information-management-system-lims--114329
- Grand View Research, Laboratory Information Management System Market 2026-2033: https://www.grandviewresearch.com/industry-analysis/laboratory-information-management-system-lims-market
- MarketsandMarkets via GlobeNewswire, LIMS market release, 26 June 2026: https://www.globenewswire.com/news-release/2026/06/26/3318323/0/en/laboratory-information-management-systems-lims-market-size-expected-to-reach-usd-5-19-billion-by-2030-marketsandmarkets.html
- Grand View Research, Clinical Laboratory Services Market 2026-2033: https://www.grandviewresearch.com/industry-analysis/clinical-laboratory-services-market
- Ayushman Bharat Digital Mission official website: https://abdm.gov.in/abdm
- ABDM Digital Health Incentive Scheme: https://abdm.gov.in/DHIS
