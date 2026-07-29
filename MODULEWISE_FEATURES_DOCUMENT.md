# Modulewise Features Document

## 1. Platform / Developer Admin Module

### 1. Purpose

The Platform / Developer Admin Module is used to manage the complete multi-tenant LIMS platform. It controls lab onboarding, lab status, tenant configuration, enabled modules, developer users, and platform-level access.

### 2. What This Module Does

It allows platform administrators to create and manage labs, configure each lab tenant, control lab status, manage tenant access, and maintain platform-level permissions and role templates.

### 3. Main Users

Developer owner, platform admin, implementation team, support team.

### 4. Key Features

Lab creation, lab listing, lab edit, archived lab view, deleted lab view, tenant admin access reset, enabled module control, subscription plan assignment, platform dashboard, developer profile, developer system page, master permission catalog, and tenant role template support.

### 5. Business Benefits

It allows one platform to serve multiple labs independently. Each lab gets separate data, separate branding/settings, and separate user access. This reduces deployment effort, supports subscription-based business, and helps the platform owner manage many labs from one place.

### 6. Connected Modules

Authentication, RBAC, Settings, Users, Dashboard, Audit, Tenant Database, Lab Operations modules.

### 7. Current / Pending Scope

Current: lab create/list/edit, archived/deleted lab views, tenant admin access handling, enabled modules, plan fields, developer user structure, master lab model.

Pending: stronger platform audit trail, complete subscription enforcement, lab recovery workflow polish, controlled permanent deletion, backup/restore process, and production support tools.

## 2. Authentication & Session Module

### 1. Purpose

The Authentication & Session Module controls secure login, logout, current user lookup, password reset, and session-based access for tenant users and developer users.

### 2. What This Module Does

It verifies user credentials, creates secure sessions, identifies the current logged-in user, protects APIs, supports forgot/reset password, and applies tenant-aware access control.

### 3. Main Users

All system users, lab admins, lab staff, doctors, developer admins.

### 4. Key Features

Login, logout, current user API, forgot password, reset password, change password, secure session cookies, password policy validation, tenant session validation, malformed token handling, role permission loading, and protected route/API access.

### 5. Business Benefits

It protects lab data from unauthorized access, keeps every user's work tied to their identity, supports secure password recovery, and helps the lab maintain privacy and accountability.

### 6. Connected Modules

RBAC, Users, Settings, Developer Admin, all protected lab modules.

### 7. Current / Pending Scope

Current: login/logout/me APIs, forgot/reset password flow, password policy, session handling, role permission support, production-safe error handling.

Pending: broader rate limiting coverage, stronger session monitoring, full audit logging for security events, and additional production hardening.

## 3. Dashboard Module

### 1. Purpose

The Dashboard Module gives users a quick summary of important lab activity and operational status.

### 2. What This Module Does

It displays summary metrics based on the logged-in user's permissions, such as patient activity, sample activity, report activity, billing or operational counts, and other high-level lab indicators.

### 3. Main Users

Lab owner, lab admin, lab manager, front desk staff, accounts users, technicians.

### 4. Key Features

Dashboard page, live stats API, permission-aware counts, tenant-specific dashboard data, module-aware visibility, and quick operational overview.

### 5. Business Benefits

It helps managers understand the current workload, pending work, and daily activity without opening every module separately.

### 6. Connected Modules

Patients, Billing, Samples, Reports, Analytics, Accounts, RBAC.

### 7. Current / Pending Scope

Current: dashboard page, stats API, permission-aware response, tenant-specific data loading.

Pending: deeper widgets for pending samples, pending reports, revenue trends, doctor referrals, urgent work, and daily performance.

## 4. Patient Module

### 1. Purpose

The Patient Module is used to create and manage patient records in the lab. It becomes the base identity for billing, sample collection, report generation, and visit history.

### 2. What This Module Does

It allows staff to register new patients, search existing patients, edit details, check visit history, and create a new visit for returning patients.

### 3. Main Users

Front desk staff, receptionist, lab admin, billing staff, lab manager.

### 4. Key Features

Patient registration, patient ID generation, UH ID, barcode, duplicate phone warning, grid/list view, filters, edit patient, delete patient, patient sidebar, visit history, and new visit.

### 5. Business Benefits

Faster registration, fewer duplicate records, better traceability, repeat visit handling, better patient lookup, and a clear link between patient, bill, sample, and report.

### 6. Connected Modules

Billing, Samples, Reports, Doctors, Test Master, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: registration, search, filters, grid/list view, edit, delete, visit history, new visit, billing lookup.

Pending: soft delete, restore, stronger duplicate detection, audit logs, deletion protection when bills/reports exist, and cleaner separation between patient registration and billing/order creation.

## 5. Doctor Module

### 1. Purpose

The Doctor Module manages referring doctors, doctor profiles, referral details, doctor type, commission information, and doctor-related business tracking.

### 2. What This Module Does

It allows the lab to register doctors, search and view doctors, edit doctor information, track doctor status, categorize doctors, and connect doctors with patients, billing, reports, commissions, and analytics.

### 3. Main Users

Lab admin, front desk staff, lab manager, accounts staff, doctor users, business owner.

### 4. Key Features

Doctor registration, doctor ID generation, doctor search, doctor table/grid, doctor edit, profile page, doctor self-profile, qualification details, MCI number validation, contact details, clinic details, investor/non-investor type, status, commission percentage, and pending payout tracking.

### 5. Business Benefits

It helps the lab manage referral relationships, track business generated by doctors, calculate commissions, and maintain accurate doctor contact and practice information.

### 6. Connected Modules

Patients, Billing, Reports, Accounts, Analytics, Doctor Commission/Payout, RBAC.

### 7. Current / Pending Scope

Current: registration, listing, search, edit, profile, validations, commission fields, payout API support.

Pending: soft delete/restore, detailed referral performance dashboard, stronger doctor-wise statement views, full audit logging, and deletion protection when linked records exist.

## 6. Test Master Module

### 1. Purpose

The Test Master Module manages the lab's test catalog, categories, test definitions, parameters, normal ranges, package/profile definitions, sample types, prices, and inventory linkage.

### 2. What This Module Does

It allows lab admins to define which tests and packages the lab offers, how much they cost, what parameters are reported, which sample type is required, and which inventory items may be consumed.

### 3. Main Users

Lab admin, lab manager, pathologist, technician, billing staff.

### 4. Key Features

Test categories, test definitions, test code, sample type, price, parameters, required fields, normal ranges, male/female ranges, packages/profiles, active/inactive status, duplicate prevention, price permission checks, and inventory item requirements.

### 5. Business Benefits

It standardizes billing and reporting. Staff can select accurate tests, reports can use predefined parameters, pricing becomes controlled, and lab workflows become more consistent.

### 6. Connected Modules

Billing, Patient Registration, Samples, Reports, Inventory, RBAC.

### 7. Current / Pending Scope

Current: categories, definitions, packages, parameters, pricing, status, permission checks, inventory linkage fields.

Pending: workflow polish, restore/deactivate strategy, advanced reference ranges, report template dependency, stronger package validation, and complete test master audit trail.

## 7. Billing Module

### 1. Purpose

The Billing Module is the main front-desk transaction module. It creates bills for patient investigations and tracks payment, discounts, taxes, billing status, and workflow status.

### 2. What This Module Does

It allows users to create bills, select patients/tests/packages, calculate payable amount, apply discount or tax, collect payments, view billing history, generate invoices, settle bills, and connect bills to samples, reports, accounts, and commissions.

### 3. Main Users

Front desk staff, receptionist, billing cashier, accounts staff, lab admin, lab manager.

### 4. Key Features

Bill ID generation, patient selection, test/package selection, subtotal, discount, tax, total amount, unpaid/partial/paid/cancelled status, payment breakdown, payment history, receipts, invoice generation, settlement modal, billing history, cancellation, priority, referral doctor, and workflow status.

### 5. Business Benefits

It reduces billing mistakes, improves payment tracking, shows dues clearly, connects financial activity with lab operations, and gives the lab better control over revenue.

### 6. Connected Modules

Patients, Test Master, Samples, Reports, Accounts, Doctor Commission, Corporate Accounts, Dashboard, Analytics, RBAC.

### 7. Current / Pending Scope

Current: bill creation, billing history, update/cancel routes, settlement, receipts, invoice API, payment history, financial status tracking.

Pending: complete refund flow polish, stronger daily close process, improved cancellation controls, audit logging, and full order/workflow separation where required.

## 8. Sample Management Module

### 1. Purpose

The Sample Management Module tracks samples from registration and collection through processing, completion, rejection, release, and archival.

### 2. What This Module Does

It creates and manages sample records linked to patients, billing items, and tests. It tracks sample ID, barcode, sample type, status, collection/received details, custody events, result parameters, rejection reasons, and reserved inventory.

### 3. Main Users

Phlebotomist, lab technician, lab manager, pathologist, front desk staff.

### 4. Key Features

Sample ID generation, barcode generation, sample list, collection workflow, status transitions, processing status, rejection workflow, custody log, batch ID, received by, received time, result parameter storage, sample wizard, barcode route, and inventory reservation fields.

### 5. Business Benefits

It improves sample traceability, reduces sample mix-ups, helps staff track pending and rejected samples, and supports reliable report generation.

### 6. Connected Modules

Billing, Patients, Test Master, Reports, Inventory, Dashboard, Notifications, RBAC.

### 7. Current / Pending Scope

Current: sample model, sample APIs, sample page, wizard, barcode endpoint, status transitions, custody log, result fields.

Pending: complete collection UX polish, barcode printing/scanning workflow, stronger rejection approval, full inventory consumption automation, audit logging, and restore/archive controls.

## 9. Report Management Module

### 1. Purpose

The Report Management Module manages laboratory result entry, review, approval, release, printing, downloading, and report version tracking.

### 2. What This Module Does

It allows users to enter test results, validate report parameters, review reports, approve reports, release final reports, view report details, and preserve previous report versions.

### 3. Main Users

Lab technician, report typist, pathologist, lab manager, lab admin.

### 4. Key Features

Report ID generation, result parameters, numeric/text values, high/low/normal flags, draft status, reviewed status, approved status, released status, remarks, report template type, previous version history, report detail page, report preview, print/download permission, and release workflow.

### 5. Business Benefits

It improves result accuracy, creates a controlled approval process, reduces unauthorized report release, keeps report history, and supports professional patient reporting.

### 6. Connected Modules

Patients, Samples, Billing, Test Master, Dashboard, Accounts, RBAC.

### 7. Current / Pending Scope

Current: report list/detail, report model, result entry structure, review/approve/release workflow, version history, report routes.

Pending: final branded PDF format, digital signature, report template expansion, report correction approval flow, audit logging, and release restrictions polish.

## 10. Accounts Module

### 1. Purpose

The Accounts Module manages the lab's financial records, ledgers, receipts, invoices, manual entries, profit/loss, expenses, dues, and financial reporting.

### 2. What This Module Does

It tracks income from billing, payment receipts, expenses, journal entries, account balances, ledgers, profit/loss, outstanding amounts, daily collections, weekly/monthly reports, and consolidated financial reports.

### 3. Main Users

Accounts manager, billing cashier, lab owner, lab admin, finance staff.

### 4. Key Features

Chart of accounts, ledger, invoices, receipts, manual journal entries, expenses, P&L, account dashboard, daily collection report, weekly report, monthly revenue report, income-expense report, outstanding report, consolidated report, and accounting APIs.

### 5. Business Benefits

It gives the lab a clear picture of revenue, dues, expenses, profitability, and collections. It reduces manual financial tracking and helps owners make better business decisions.

### 6. Connected Modules

Billing, Payments, Expenses, Corporate Accounts, Doctor Commission, Analytics, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: account models, journal entries, receipts, reports, account pages, P&L, invoices, ledgers, expenses connection.

Pending: daily close workflow completion, stronger reconciliation, advanced export formats, audit logging, and accountant approval flows.

## 11. Corporate Accounts Module

### 1. Purpose

The Corporate Accounts Module manages company or institutional clients that receive lab services on credit, statement, or consolidated billing terms.

### 2. What This Module Does

It allows the lab to create corporate accounts, maintain corporate details, connect bills to corporate payment mode, generate statements, and track corporate receivables.

### 3. Main Users

Accounts staff, lab owner, billing staff, lab admin, corporate billing manager.

### 4. Key Features

Corporate account creation, corporate account update, account status, credit limit fields, billing linkage, corporate statement route, payment mode support, and corporate account listing.

### 5. Business Benefits

It helps labs work with companies, clinics, hospitals, and camps where payment may be settled later. It improves credit tracking and makes statement-based billing easier.

### 6. Connected Modules

Billing, Accounts, Receipts, Analytics, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: corporate account model, corporate APIs, corporate page, statement API, billing payment mode support.

Pending: full corporate settlement workflow, aging report, credit-limit alerts, statement PDF/export, and audit logging.

## 12. Expenses Module

### 1. Purpose

The Expenses Module records and categorizes lab expenses so the business can track spending and calculate profitability accurately.

### 2. What This Module Does

It allows users to create expense categories, record expense entries, edit expenses, delete/update records, and connect expenses to accounting reports.

### 3. Main Users

Accounts staff, lab owner, lab admin, finance team.

### 4. Key Features

Expense categories, expense entries, expense APIs, expense page, amount tracking, category-wise expense recording, date-wise reporting support, and account report integration.

### 5. Business Benefits

It helps the lab understand operating costs, control spending, compare income versus expenses, and prepare financial reports.

### 6. Connected Modules

Accounts, Analytics, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: expense category model, expense entry model, expense APIs, expenses page, accounting report connection.

Pending: approval workflow, attachment support, recurring expenses, export, audit logging, and deletion recovery.

## 13. Doctor Commission / Payout Module

### 1. Purpose

The Doctor Commission / Payout Module manages referral commission calculation and payout tracking for doctors.

### 2. What This Module Does

It connects doctor commission percentage with billing records, tracks commission amount, supports payout actions, and helps accounts staff manage pending payouts.

### 3. Main Users

Accounts staff, lab owner, lab admin, billing manager.

### 4. Key Features

Doctor commission percentage, pending payout field, commission journal entry linkage, billing commission amount, doctor payout API, commission report route, and accounts commission page.

### 5. Business Benefits

It improves referral payment transparency, reduces manual commission calculations, and helps the lab manage doctor relationships professionally.

### 6. Connected Modules

Doctors, Billing, Accounts, Analytics, Reports, RBAC.

### 7. Current / Pending Scope

Current: commission fields, billing commission linkage, payout API, commission report route, commission page.

Pending: detailed payout statement, approval workflow, paid/unpaid history, doctor-wise commission dashboard, and audit trail.

## 14. Inventory Module

### 1. Purpose

The Inventory Module manages reagents, consumables, stock levels, batches, suppliers, purchase orders, expiry, locations, and stock movement.

### 2. What This Module Does

It records inventory items, units of measure, suppliers, storage conditions, locations, stock batches, purchase orders, and stock movements. It also supports expiry tracking, reorder levels, minimum stock, and test-wise inventory requirements.

### 3. Main Users

Inventory manager, lab manager, technician, lab admin, accounts staff.

### 4. Key Features

Inventory items, item codes, categories, item types, UOMs, suppliers, storage conditions, locations, purchase orders, stock movements, import, export, batch tracking, expiry date, quantity conversion, stock on hand, reserved stock, minimum stock, reorder level, preferred supplier, manufacturer, and inventory permissions.

### 5. Business Benefits

It helps prevent reagent stockouts, reduce expired stock loss, track consumption, improve purchasing decisions, and connect inventory usage with lab testing.

### 6. Connected Modules

Test Master, Samples, Accounts, Notifications, Dashboard, Analytics, RBAC.

### 7. Current / Pending Scope

Current: inventory models, inventory APIs, inventory page, suppliers, locations, UOMs, types, storage conditions, purchase orders, movements, import/export.

Pending: complete low-stock alert workflow, automatic consumption during sample/report processing, expiry dashboards, purchase approval, wastage tracking, and audit logging.

## 15. Analytics Module

### 1. Purpose

The Analytics Module provides business and operational insights for the lab.

### 2. What This Module Does

It summarizes lab performance using billing, patient, doctor, accounts, and operational data. It helps users understand trends, revenue, referrals, pending work, and business growth.

### 3. Main Users

Lab owner, lab admin, lab manager, accounts manager, doctor investor.

### 4. Key Features

Analytics page, analytics API, revenue summaries, doctor/referral analysis direction, permission-aware commission visibility, business reporting support, and plan-based availability.

### 5. Business Benefits

It helps decision makers understand how the lab is performing, where revenue comes from, which doctors refer business, and which areas need operational attention.

### 6. Connected Modules

Billing, Accounts, Doctors, Patients, Samples, Reports, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: analytics page, analytics API, permission-aware financial/commission handling.

Pending: deeper charts, trend comparisons, doctor-wise dashboards, test-wise revenue, pending workflow analytics, and exportable analytics reports.

## 16. Settings / User / Role / Permission Module

### 1. Purpose

The Settings / User / Role / Permission Module manages lab users, roles, and permissions so each staff member can access only the modules and actions they are allowed to use.

### 2. What This Module Does

It allows admins to manage users, create and update roles, assign permissions, apply permission dependencies, and control access to module actions.

### 3. Main Users

Lab admin, lab owner, lab manager, platform admin.

### 4. Key Features

User management, role management, permission matrix, permission search, dependency handling, dangerous permission flags, role templates, plan-aware permission catalog, enabled-module filtering, and user profile permission summary.

### 5. Business Benefits

It protects sensitive data, reduces misuse, supports staff-specific workflows, and gives management control over who can create, edit, delete, collect payments, release reports, and manage accounts.

### 6. Connected Modules

Authentication, Developer Admin, all tenant modules, Audit, Dashboard.

### 7. Current / Pending Scope

Current: users page, settings page, role manager, permission matrix, settings APIs, RBAC config, role templates, client/server permission checks.

Pending: more granular permission review logs, role approval workflow, better plan enforcement, and audit logging for every permission change.

## 17. Audit Log Module

### 1. Purpose

The Audit Log Module records important system actions so the lab can review who did what and when.

### 2. What This Module Does

It stores audit events for tenant activity and provides an audit page/API for reviewing sensitive or operational actions.

### 3. Main Users

Lab admin, lab owner, compliance user, platform admin, support team.

### 4. Key Features

Audit log model, audit API, audit page, user/action metadata, tenant-level audit structure, permission-based audit viewing, and support for operational/security event tracking.

### 5. Business Benefits

It improves accountability, supports compliance, helps investigate mistakes, and gives management visibility into important changes.

### 6. Connected Modules

Authentication, Patients, Doctors, Billing, Samples, Reports, Accounts, Inventory, Settings, Developer Admin.

### 7. Current / Pending Scope

Current: audit model, audit page, audit API, audit view permission support.

Pending: shared audit logging across all create/update/delete/restore/payment/report-release actions, developer audit events, export, filtering polish, and retention rules.

## 18. Search & Notifications Module

### 1. Purpose

The Search & Notifications Module helps users quickly find important records and see operational alerts.

### 2. What This Module Does

It provides topbar/global search across permitted modules and generates notification items based on operational rules such as inactive doctors, low inventory, and pending reports.

### 3. Main Users

Front desk staff, lab manager, technician, accounts staff, lab admin.

### 4. Key Features

Global search API, permission-aware search scopes, patient search, doctor search, test search, sample search, report search, notification rules, module-aware alerts, priority labels, and navigation links.

### 5. Business Benefits

It saves time, reduces navigation effort, helps users act on pending work, and makes important records easier to locate.

### 6. Connected Modules

Patients, Doctors, Tests, Samples, Reports, Inventory, Dashboard, RBAC.

### 7. Current / Pending Scope

Current: search route, configured search scopes, notification route, notification rules, permission-aware visibility.

Pending: richer notification logic, real-time alerts, read/unread status, user-specific notification preferences, and advanced search filters.

