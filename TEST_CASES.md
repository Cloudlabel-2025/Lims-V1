# LIMS Project Test Cases

Use these cases as the regression checklist for the full project. Run them after every pull, and run `npm run lint`, `npm run build`, and `npm test` before release.

## Authentication And Access

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AUTH-01 | Unauthenticated dashboard access | Open any `/dashboard` page while logged out. | User is redirected to login or blocked by auth middleware. |
| AUTH-02 | Valid login | Login with active tenant user credentials. | Dashboard opens and all API calls use the same tenant. |
| AUTH-03 | Tenant isolation | Login as tenant A, then query records created under tenant B. | Tenant B records are not visible. |
| AUTH-04 | Logout | Click logout and refresh a protected page. | Session is cleared and protected pages are inaccessible. |

## Dashboard Navigation

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| NAV-01 | Sidebar navigation | Move through Dashboard, Patients, Billing, Accounts, Reports, Doctors, Samples, Inventory, Quality, Settings. | Each page loads without console errors and active navigation state is correct. |
| NAV-02 | Browser back/forward | Navigate across three modules, then use browser back and forward. | Correct previous and next pages render with preserved route state where applicable. |
| NAV-03 | Mobile navigation | Open app at mobile width and navigate every module. | Menus are reachable, text does not overlap, and primary actions remain visible. |
| NAV-04 | Refresh on detail pages | Refresh patient edit/detail and billing flows. | Page reloads data and does not show stale empty state. |

## Patients

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| PAT-01 | Register patient with required fields | Enter valid patient details and save. | Patient is created and appears in patient list. |
| PAT-02 | Duplicate patient warning | Create patient with same phone/name or barcode. | Duplicate check warns before forced creation. |
| PAT-03 | Force duplicate patient | Confirm duplicate creation. | Patient is created only after explicit confirmation. |
| PAT-04 | Register patient with tests/packages | Select tests/packages while registering patient. | Patient, billing record, and samples are created together. |
| PAT-05 | Registration validation | Submit blank required fields. | Form blocks save and shows meaningful validation. |
| PAT-06 | Patient pagination | Create more than 50 patients and open patient list. | Next/Previous pagination works and total count is correct. |
| PAT-07 | Patient search | Search by name, phone, patient ID, and barcode. | Matching patients appear and pagination resets correctly. |
| PAT-08 | Edit patient | Change patient demographic fields and save. | Updated details persist after refresh. |

## Doctors

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DOC-01 | Create doctor | Add a doctor with name and contact details. | Doctor appears in list and patient registration dropdown. |
| DOC-02 | Doctor search | Search by doctor name, phone, specialization, or code. | Matching doctors appear. |
| DOC-03 | Doctor pagination | Add more than 50 doctors. | Pagination works and count is accurate. |
| DOC-04 | Status filter | Filter active/inactive doctors if available. | List respects selected status. |

## Billing And Settlement

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| BILL-01 | Create bill | Create a billing record for selected patient and tests. | Bill total, discount, due amount, and line items are correct. |
| BILL-02 | Billing pagination | Create more than 50 bills and open Billing History. | Next/Previous controls load correct pages. |
| BILL-03 | Full settlement | Settle bill for exact remaining balance. | Bill status becomes paid and payment journal entry is created. |
| BILL-04 | Partial settlement | Pay less than balance and confirm. | Bill status remains partial/pending and remaining due is shown. |
| BILL-05 | Overpayment prevention | Try to pay more than remaining balance. | Save is blocked with overpayment error. |
| BILL-06 | Multi-payment settlement | Pay partially twice. | Already paid and remaining due are calculated correctly. |
| BILL-07 | Tenant-safe settlement | Try settling another tenant's bill ID. | API rejects or returns not found. |
| BILL-08 | Settlement refresh | Settle a bill and reopen billing history. | Updated payment state is visible without stale cached data. |

## Accounting

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| ACC-01 | Invoice journal entry | Register patient with paid tests/packages. | Debit/credit journal entry balances and links to bill. |
| ACC-02 | Payment journal entry | Settle billing record. | Cash/bank and receivable journal entry is posted correctly. |
| ACC-03 | Ledger pagination | Create more than 50 journal entries. | Ledger pagination works and entries remain sorted by date. |
| ACC-04 | Ledger filters | Filter journal entries by date/account/type if available. | Results match selected filters and page resets to first page. |
| ACC-05 | Expenses | Add an expense and view Accounts expense tab. | Expense appears with correct amount and pagination. |
| ACC-06 | Profit and Loss | Compare billing income and expense totals for a date range. | P&L totals match source records. |
| ACC-07 | Balanced journals | Inspect all generated journals. | Every journal entry total debit equals total credit. |

## Reports

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| REP-01 | Patient report list | Open Reports page after creating patients. | Patient data loads from paginated API shape. |
| REP-02 | Report generation | Generate report for patient/sample. | Report opens with correct patient, test, and result details. |
| REP-03 | Report navigation | Move from patient/sample to report page and back. | Navigation returns to the correct context. |
| REP-04 | Empty report state | Open Reports with no matching data. | Page shows useful empty state and no crash. |

## Samples

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SMP-01 | Sample creation from registration | Register patient with selected tests. | Expected samples are created with correct patient and bill links. |
| SMP-02 | Sample status update | Move sample through collected/received/processing/completed states. | Status persists and timestamps remain logical. |
| SMP-03 | Sample search | Search by barcode, patient, or sample ID. | Correct sample records appear. |
| SMP-04 | Sample navigation | Open sample from patient/billing context. | Page routes to correct sample and preserves data. |

## Inventory

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| INV-01 | Add inventory item | Create item with name, unit, stock, and reorder level. | Item appears with correct stock. |
| INV-02 | Stock adjustment | Increase and decrease stock. | Quantity updates and does not become negative unless explicitly allowed. |
| INV-03 | Low stock | Set stock below reorder level. | Low-stock indicator appears. |
| INV-04 | Inventory search/filter | Search item name or category. | Matching inventory records appear. |

## Quality

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| QLT-01 | Quality record creation | Create QC record for a test/instrument. | QC record saves and appears in list. |
| QLT-02 | Quality status | Mark QC pass/fail. | Status and notes persist after refresh. |
| QLT-03 | Quality dashboard | Open Quality page with records present. | Metrics and lists load without hook or console errors. |

## Settings And Users

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SET-01 | User creation | Admin creates a new user. | User can login with correct role and tenant. |
| SET-02 | Role restriction | Login as non-admin and open admin-only settings. | Restricted actions are hidden or blocked. |
| SET-03 | Profile/settings update | Change tenant/profile settings. | Values persist after refresh. |
| SET-04 | Invalid settings | Submit invalid required values. | Save is blocked with validation message. |

## UI Regression

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| UI-01 | Desktop layout | Check every module at 1366px width. | No overlapping text, clipped buttons, or broken tables. |
| UI-02 | Tablet layout | Check every module around 768px width. | Tables/cards remain usable and actions are reachable. |
| UI-03 | Mobile layout | Check every module around 390px width. | Content stacks cleanly and no horizontal overflow appears. |
| UI-04 | Loading states | Reload each page with slow network. | Loading indicators appear and no incorrect empty states flash permanently. |
| UI-05 | Error states | Temporarily fail an API request. | Page shows an error state and recovers after retry/refresh. |

## API Regression

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| API-01 | Paginated APIs | Call patient, doctor, billing, journal entry, and expense APIs with page/limit. | Response includes records and pagination metadata. |
| API-02 | Invalid page/limit | Call paginated APIs with invalid values. | API falls back safely or rejects with clear error. |
| API-03 | Search APIs | Call searchable APIs with special characters. | Search is escaped and does not throw regex errors. |
| API-04 | Transaction rollback | Force billing creation failure during patient registration. | Patient, bill, and samples do not partially save. |
| API-05 | Accounting seed | Create billing/settlement in a fresh tenant. | Required chart of accounts is seeded before journals post. |
