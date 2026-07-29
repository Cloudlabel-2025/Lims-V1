# Proper System Plan Document: LIMS SaaS Platform

Prepared: 27 July 2026  
System: LIMS Core  
Planning horizon: MVP hardening, production launch, and scalable SaaS growth

## 1. Planning Objective

The objective is to convert the current LIMS Core application into a production-ready, investor/client-presentable SaaS platform for diagnostic laboratories.

This plan is based on the current repository state, existing documentation, `Requirements_Flow.csv`, visible pages, API routes, models, RBAC configuration, and known pending items.

The plan prioritizes trust, workflow completion, and commercial readiness. The system already has many modules; the next phase should finish the core clinical and financial workflow before adding more breadth.

## 2. Product Vision

Build a modular LIMS SaaS platform that allows a lab to manage the full diagnostic workflow:

Patient registration -> doctor referral -> test selection -> billing -> payment -> sample collection -> result entry -> verification -> report release -> patient/doctor access -> accounts posting -> analytics.

The product should be simple enough for small labs, controlled enough for mid-sized chains, and structured enough for a SaaS platform owner to manage many labs.

## 3. Strategic Priorities

Priority 1: Production trust.

The system must protect lab and patient data through tenant isolation, RBAC, audit logs, soft delete, recovery, secure sessions, safe API responses, backups, and tested workflows.

Priority 2: Core workflow completion.

Patient, doctor, test, billing, sample, report, payment, receipt, and accounts workflows must work end to end before secondary modules receive major investment.

Priority 3: Commercial packaging.

The product needs clear plans, module bundles, onboarding process, implementation checklist, demo data, and client-ready documentation.

Priority 4: Scalable SaaS operation.

The platform owner needs lab lifecycle control, subscription enforcement, support tooling, backup/restore, monitoring, and release discipline.

## 4. Current Status Summary

Completed or mostly complete:

- Multi-tenant master/tenant architecture.
- Developer lab management foundation.
- Secure authentication and password reset.
- Password policy enforcement.
- Production-safe API error helper direction.
- RBAC catalog and role templates.
- Patients, doctors, tests, billing, samples, reports, accounts, inventory, analytics pages and APIs.
- Doctor portal and patient portal foundations.
- Billing as central transaction module.
- Initial automated tests.
- Module and permission metadata.

In progress:

- Billing/order creation completion.
- Sample collection workflow.
- Result entry workflow.
- Accounts settlement and commission flow.

Pending/high priority:

- Soft delete and recovery.
- Report verification/release polish.
- Branded report PDF and digital signature.
- Full audit logging.
- Runtime subscription enforcement.
- Production deployment readiness.
- Backup/restore.
- Daily close and reconciliation.
- Expanded automated tests.

## 5. Recommended Product Scope for First Production Release

The first production release should include only the features needed for a lab to run live operations safely.

Must-have modules:

- Platform admin.
- Tenant authentication.
- Users, roles, and permissions.
- Dashboard.
- Patients.
- Doctors.
- Test master.
- Billing.
- Samples.
- Reports.
- Accounts basics.
- Audit logs.
- Patient portal.
- Doctor portal.

Must-have workflows:

- Lab onboarding.
- User creation and role assignment.
- Patient registration.
- Doctor registration and referral association.
- Test and package setup.
- Bill creation with payment status.
- Receipt and invoice generation.
- Sample collection and status tracking.
- Result entry.
- Pathologist verification/release.
- Branded report print/download.
- Patient released-report access.
- Doctor referred-patient report access.
- Dues and collection tracking.
- Doctor commission calculation.
- Soft delete and restore.
- Audit logging.

Defer from first production release:

- Advanced inventory automation.
- QC/calibration module.
- ABDM production integration.
- Instrument integration.
- Advanced BI dashboards.
- Multi-branch consolidation.
- AI-assisted reporting.

## 6. Phase Plan

### Phase 1: Stabilize Foundation

Goal: Make the current app safer and easier to deploy.

Work items:

- Add environment validation for required secrets and database settings.
- Confirm all protected APIs use tenant/session/RBAC checks.
- Confirm no API trusts browser-supplied tenant IDs where session tenant should be authoritative.
- Standardize error responses using the shared API response helper.
- Add common audit helper function.
- Add common soft delete fields and helpers.
- Review database indexes for high-traffic entities.
- Ensure lab theme loading fails safely.
- Review role templates and dangerous permissions.

Deliverables:

- Environment checklist.
- Security checklist.
- Shared audit helper.
- Shared soft delete helper.
- Tenant isolation review notes.

Acceptance criteria:

- App builds successfully.
- Login/logout/me/reset flows pass tests.
- Tenant resolution is documented.
- Protected routes reject unauthenticated access.
- Dangerous actions are permission-gated.

Estimated duration: 1 to 2 weeks.

### Phase 2: Data Safety and Recovery

Goal: Prevent accidental permanent loss of operational records.

Work items:

- Add `isDeleted`, `deletedAt`, `deletedBy`, `deleteReason`, and `restoreHistory` where required.
- Implement soft delete for patients, doctors, test categories, test definitions, packages, billing records, samples, reports, expenses, inventory entities, and corporate accounts.
- Hide deleted records from normal list APIs.
- Add restore routes for priority modules.
- Add admin recovery center or module-level deleted tabs.
- Enforce 30-day normal recovery window.
- Enforce 30-60 day protected archive period.
- Allow hard delete only after 60 days and only with dangerous permission.
- Audit delete, restore, and hard delete actions.

Deliverables:

- Soft delete schema updates.
- Recovery APIs.
- Recovery UI.
- Hard delete eligibility rules.
- Data lifecycle policy.

Acceptance criteria:

- Deleted patients/doctors/tests do not disappear permanently.
- Linked historical bills/reports remain stable.
- Restore works within the configured window.
- Hard delete is blocked before eligibility.
- Audit logs show delete/restore actor and reason.

Estimated duration: 2 weeks.

### Phase 3: Core Front-Desk Workflow Completion

Goal: Make patient, doctor, test, billing, and sample handoff reliable.

Work items:

- Keep patient registration clean and avoid accidental bill creation side effects.
- Complete billing creation from existing/new patient.
- Support tests and packages with correct pricing.
- Apply discount/tax/payment validation.
- Generate bill IDs consistently.
- Link billing records to samples and reports.
- Support paid, unpaid, partial, cancelled states.
- Improve pending payment and settlement flow.
- Add invoice and receipt polish.
- Add cancellation reason and restrictions.
- Add audit for bill create/update/settle/cancel.

Deliverables:

- Stable billing workflow.
- Clear front-desk UX.
- Settlement history.
- Receipt/invoice output.
- Billing audit coverage.

Acceptance criteria:

- A user can register/select a patient, create bill, collect payment, print receipt, and see payment history.
- Partial payment and due balance display correctly.
- Cancelled bills cannot proceed into normal sample/report flow unless explicitly allowed.
- Doctor commission is captured according to referral settings.

Estimated duration: 2 to 3 weeks.

### Phase 4: Samples and Lab Workflow

Goal: Make sample handling traceable and practical.

Work items:

- Complete sample collection screen.
- Generate and print barcode/sample ID.
- Support collected, received, processing, rejected, completed, and reported statuses.
- Add custody log actions.
- Add rejection reason and approval if required.
- Link sample status to report readiness.
- Reserve or consume inventory items where configured.
- Add sample audit coverage.

Deliverables:

- Sample collection workflow.
- Barcode print/scanning direction.
- Status transition rules.
- Custody log.
- Rejection handling.

Acceptance criteria:

- Sample created from billing can be collected and tracked.
- Barcode route returns usable output.
- Rejected samples are visible and cannot silently produce final reports.
- Sample actions show in audit logs.

Estimated duration: 2 weeks.

### Phase 5: Reports and Patient/Doctor Release

Goal: Complete the clinical output workflow.

Work items:

- Complete result entry based on test parameters.
- Validate required values.
- Flag low/high/normal values for numeric parameters.
- Support draft, reviewed, approved, released status.
- Restrict verification/release by RBAC.
- Add digital signature support.
- Build final branded report PDF.
- Add correction/version workflow.
- Ensure patient and doctor portals show only released reports.
- Add report audit events.

Deliverables:

- Result entry panel.
- Verification/release controls.
- Branded PDF.
- Signature handling.
- Released-report portal visibility.
- Report versioning/correction trail.

Acceptance criteria:

- Technician can enter results but cannot release without permission.
- Pathologist can verify/release.
- Released report is printable/downloadable with lab branding.
- Draft/reviewed/approved but unreleased reports are hidden from patient and doctor portals.
- Every report status change is audited.

Estimated duration: 3 weeks.

### Phase 6: Accounts, Settlement, and Commissions

Goal: Make financial tracking trustworthy.

Work items:

- Complete payment receipts and settlement history.
- Add refund approval and audit flow.
- Add daily close workflow.
- Reconcile cash, online, card, corporate, and due payments.
- Complete doctor commission reports and payout history.
- Complete corporate settlement and aging.
- Connect billing events to journal entries consistently.
- Add export and PDF polish.

Deliverables:

- Daily collection report.
- Outstanding report.
- P&L and income-expense report polish.
- Commission payout statement.
- Corporate statement.
- Refund and close audit.

Acceptance criteria:

- Accounts user can reconcile daily collections.
- Refunds require permission and reason.
- Doctor pending payout matches eligible paid referral bills.
- Corporate balances and statements are clear.

Estimated duration: 2 to 3 weeks.

### Phase 7: Inventory Operational Readiness

Goal: Make inventory useful without delaying core launch.

Work items:

- Finalize item, category, type, supplier, location, UOM, storage condition, and purchase order flows.
- Add low-stock and expiry alerts.
- Add manual stock movement approval where needed.
- Link test requirements to stock reservation/consumption.
- Add inventory import/export validation.
- Add audit coverage.

Deliverables:

- Inventory master completion.
- Stock movement flow.
- Low-stock and expiry alerts.
- Purchase order workflow.

Acceptance criteria:

- Inventory manager can add stock, move stock, track expiry, and export inventory.
- Low-stock notifications are visible.
- Test-linked consumption can be reported or manually confirmed.

Estimated duration: 2 weeks.

### Phase 8: Subscription, Packaging, and Platform Operations

Goal: Make the product sellable as SaaS.

Work items:

- Enforce Basic, Professional, and Enterprise module access at runtime.
- Add subscription status checks.
- Add lab suspend/reactivate behavior.
- Add archived/deleted lab recovery policy.
- Add platform-level audit events.
- Add platform support tools for lab lookup and access reset.
- Add demo seed data.
- Create sales demo flow.

Deliverables:

- Runtime plan enforcement.
- Lab lifecycle policy.
- Demo tenant.
- Support runbook.
- Client onboarding checklist.

Acceptance criteria:

- Disabled modules cannot be accessed through UI or direct API.
- Suspended labs cannot operate normally.
- Platform admin actions are audited.
- Sales demo can be performed end to end.

Estimated duration: 2 weeks.

### Phase 9: Testing and Production Deployment

Goal: Launch with confidence.

Work items:

- Expand unit tests for tenant resolver, auth, RBAC, patient helpers, doctor validation, billing calculations, sample transitions, and report visibility.
- Add API tests for key workflows.
- Add smoke test for project structure and protected route behavior.
- Run lint, tests, and build in CI/manual release checklist.
- Add deployment docs.
- Add backup and restore documentation.
- Add monitoring/logging plan.
- Prepare rollback process.

Deliverables:

- Automated test suite.
- Deployment guide.
- Backup/restore guide.
- Release checklist.
- Production incident runbook.

Acceptance criteria:

- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.
- Backup restore process is documented and tested on a non-production tenant.
- Release checklist is followed before go-live.

Estimated duration: 2 weeks.

## 7. Milestone Roadmap

Milestone 1: Internal Alpha

- Core pages load.
- Auth and RBAC work.
- Demo data available.
- Basic patient -> bill -> sample -> report path can be shown.

Milestone 2: Pilot Beta

- One friendly lab uses the system with supervised operations.
- Soft delete and audit coverage active.
- Report PDF usable.
- Daily support process active.

Milestone 3: Paid Production

- Billing, sample, report, accounts, and portal workflows stable.
- Backup/restore documented.
- Production deployment checklist complete.
- First paid lab onboarded.

Milestone 4: SaaS Scale

- Subscription enforcement active.
- Multiple labs onboarded.
- Support tools and monitoring active.
- Partner/demo material ready.

Milestone 5: Expansion

- Advanced analytics.
- Corporate billing polish.
- Inventory automation.
- ABDM/integration roadmap.
- White-label or reseller model.

## 8. Business Model Plan

### Basic Plan

Target: Small independent labs.

Included:

- Dashboard.
- Patients.
- Doctors.
- Test master.
- Billing.
- Samples.
- Reports.
- Basic users and roles.
- Basic receipts/invoices.

Recommended price direction:

- Low monthly subscription.
- Limited users and monthly report volume.
- Paid setup/training.

### Professional Plan

Target: Growing labs and 1-3 branch operators.

Included:

- Everything in Basic.
- Accounts.
- Analytics.
- Inventory.
- Patient portal.
- Doctor portal.
- Advanced RBAC.
- Report branding/signature.
- Exports.

Recommended price direction:

- Mid-tier monthly subscription.
- Higher usage limits.
- Annual discount.
- Optional migration package.

### Enterprise Plan

Target: Lab chains, corporate-focused labs, and white-label partners.

Included:

- Everything in Professional.
- Corporate accounts.
- Multi-location reporting.
- Advanced audit.
- Priority support.
- Custom report templates.
- Backup/restore SLA.
- Integration support.

Recommended price direction:

- Custom quote.
- Implementation fee.
- Support SLA.
- Optional integration charges.

## 9. Go-To-Market Plan

### Phase A: Founder-Led Local Sales

Actions:

- Identify 50 local diagnostic labs.
- Run workflow discovery calls.
- Demo with real lab scenarios.
- Offer pilot to 3 labs.
- Convert 1 lab to paid production.

Assets needed:

- 10-minute demo script.
- One-page brochure.
- Pricing sheet.
- Implementation checklist.
- Client-ready current system document.

### Phase B: Referral and Case Study Sales

Actions:

- Build case study from first paid lab.
- Use before/after metrics: billing speed, dues visibility, report access, commission clarity.
- Collect testimonials.
- Ask doctors/lab owners for referrals.

### Phase C: Partner Channel

Actions:

- Partner with lab consultants, equipment suppliers, and regional IT service providers.
- Offer implementation margin or reseller subscription margin.
- Provide white-label demo if Enterprise plan supports it.

## 10. Implementation Plan for Each Client Lab

Week 1: Setup

- Create lab tenant.
- Configure branding and modules.
- Create admin user.
- Configure roles.
- Import doctors, tests, packages, and prices.

Week 2: Training and Pilot

- Train front desk.
- Train sample team.
- Train report team/pathologist.
- Train accounts/admin.
- Run 20-50 pilot records.

Week 3: Go-Live

- Migrate opening dues and inventory if needed.
- Start live billing.
- Monitor sample/report workflow.
- Review daily collections.
- Fix configuration issues quickly.

Week 4: Stabilization

- Review reports, commissions, dues, and staff permissions.
- Finalize templates and exports.
- Conduct owner review.
- Move to steady support.

## 11. Risk Plan

### Risk: Incomplete Clinical Report Output

Impact: High.

Mitigation:

- Prioritize report PDF, signature, release status, and portal visibility before production.

### Risk: Financial Disputes

Impact: High.

Mitigation:

- Audit every payment, settlement, discount, refund, cancellation, and commission payout.
- Add daily close and reconciliation.

### Risk: Data Loss

Impact: Very high.

Mitigation:

- Implement soft delete, restore, backup, retention, and hard-delete restrictions.

### Risk: Tenant Data Leakage

Impact: Very high.

Mitigation:

- Enforce server-side tenant resolution.
- Test tenant isolation.
- Never trust tenant IDs from browser input for protected data ownership.

### Risk: Staff Adoption

Impact: Medium.

Mitigation:

- Keep workflows role-specific.
- Train with actual lab scenarios.
- Avoid adding unnecessary steps to front-desk billing.

### Risk: Scope Creep

Impact: High.

Mitigation:

- Freeze first production scope.
- Put advanced modules behind post-launch roadmap.
- Track every change request in `Requirements_Flow.csv`.

## 12. Future Roadmap

### 3-Month Roadmap

- Production core workflow.
- Soft delete/recovery.
- Report PDF/signature.
- Audit coverage.
- Daily collection and commission reports.
- Pilot deployment.

### 6-Month Roadmap

- Subscription enforcement.
- Corporate billing polish.
- Inventory alerts and consumption.
- Advanced analytics.
- Client onboarding automation.
- Support dashboard.

### 12-Month Roadmap

- Multi-branch consolidation.
- ABDM integration path.
- WhatsApp/SMS report notification.
- Instrument integration evaluation.
- White-label reseller model.
- Advanced backup/restore and compliance reporting.

### 24-Month Roadmap

- Marketplace integrations.
- AI-assisted operational insights.
- Regional language support.
- Advanced doctor relationship management.
- Enterprise deployment and SLA support.

## 13. Team Plan

Minimum team for production completion:

- Full-stack engineer for Next.js and APIs.
- QA/test engineer or strong testing owner.
- Product/implementation owner with lab workflow knowledge.
- UI designer for report output and workflow polish.
- DevOps/support owner for deployment, backups, and monitoring.

If the team is small, the same person can hold multiple roles, but the responsibilities should still be explicit.

## 14. Quality Plan

Required checks before every production release:

- Lint.
- Unit tests.
- Build.
- Manual smoke test.
- Auth/RBAC check.
- Patient -> billing -> sample -> report -> portal check.
- Payment/receipt check.
- Backup status check.
- Release notes.

Core test coverage targets:

- Tenant resolver.
- Auth and session validation.
- RBAC permission dependencies.
- Password policy.
- Patient portal safety.
- Doctor portal ownership.
- Billing calculations.
- Sample status transitions.
- Report visibility rules.
- Soft delete and restore.

## 15. Final Recommendation

The best next move is to complete the system in this order:

1. Soft delete, recovery, and audit foundation.
2. Billing, sample, report, and accounts end-to-end workflow.
3. Branded report PDF and portal release safety.
4. Subscription enforcement and platform operations.
5. Testing, deployment, backup, and support readiness.

This sequence turns the current broad application into a dependable LIMS SaaS product. It protects the most important asset first: trust. Once trust is established, sales and scaling become much easier.
