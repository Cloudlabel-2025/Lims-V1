# LIMS Module Test Scenarios

Use this document to verify that every module works end-to-end. These scenarios are written for manual QA, UAT, and future automation.

## 1. Authentication

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| AUTH-01 | Login with valid user | Enter valid email/password and submit. | User reaches dashboard. Session is created. |
| AUTH-02 | Login with invalid password | Enter valid email and wrong password. | Login fails with clear error. No session is created. |
| AUTH-03 | Login with inactive/locked user | Try login using inactive/locked account. | Access is denied. |
| AUTH-04 | Protected route without login | Open `/dashboard`, `/patients`, `/billing`, `/accounts`. | User is redirected or blocked. |
| AUTH-05 | Logout | Login, click logout, refresh dashboard route. | Session is removed and dashboard is inaccessible. |
| AUTH-06 | Forgot password | Submit registered email in forgot password page. | Reset flow starts without exposing sensitive data. |
| AUTH-07 | Reset password | Open valid reset link and set new password. | New password works, old password fails. |

## 2. Dashboard

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DASH-01 | Dashboard load | Login and open dashboard. | Stats/cards load without errors. |
| DASH-02 | Tenant-specific dashboard | Login under different tenants. | Each tenant sees only its own data. |
| DASH-03 | Dashboard refresh | Refresh dashboard page. | Data reloads correctly. |
| DASH-04 | Dashboard navigation | Click each dashboard shortcut/link. | Correct module page opens. |
| DASH-05 | Empty state | Use tenant with no data. | Dashboard shows zero/empty metrics without crash. |

## 3. Patients

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| PAT-01 | Register patient basic details | Fill required fields and save. | Patient is created and visible in list. |
| PAT-02 | Required validation | Submit registration with missing name/phone/gender where required. | Save is blocked with validation. |
| PAT-03 | Duplicate check | Register same name/phone/barcode. | Duplicate warning appears. |
| PAT-04 | Force duplicate | Confirm duplicate creation. | Patient is created only after confirmation. |
| PAT-05 | Register with selected tests | Select tests while registering patient. | Patient, bill, and samples are created together. |
| PAT-06 | Register with package | Select package while registering patient. | Package line items are billed and sample records created. |
| PAT-07 | Patient search | Search by name, phone, patient ID, barcode. | Matching patients are shown. |
| PAT-08 | Patient pagination | Add more than page limit. Use Next/Previous. | Correct page data and count are shown. |
| PAT-09 | Edit patient | Change address/phone/doctor and save. | Updated data persists after refresh. |
| PAT-10 | Patient detail navigation | Open edit/detail from patient list and go back. | Navigation returns cleanly to list. |

## 4. Doctors

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DOC-01 | Register doctor | Add doctor with valid details. | Doctor appears in doctors list. |
| DOC-02 | Doctor in patient form | Open patient registration after adding doctor. | Doctor appears in referral dropdown. |
| DOC-03 | Doctor validation | Submit missing required fields. | Save is blocked. |
| DOC-04 | Edit doctor | Update doctor details. | Changes persist after refresh. |
| DOC-05 | Doctor search | Search by name, phone, code, specialization. | Correct doctors appear. |
| DOC-06 | Doctor pagination | Add more than page limit. | Pagination works. |
| DOC-07 | Doctor payout | Create bill linked to doctor and test payout calculation. | Payout data matches configured commission rules. |

## 5. Billing

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| BILL-01 | Create bill manually | Select patient and tests, save bill. | Bill is created with correct total. |
| BILL-02 | Create bill from patient registration | Register patient with tests. | Bill is auto-created. |
| BILL-03 | Discount calculation | Apply discount amount/percentage if available. | Net total and due amount are correct. |
| BILL-04 | Full payment | Settle exact remaining balance. | Bill becomes paid. |
| BILL-05 | Partial payment | Pay less than remaining balance. | Bill remains partial/open with correct due. |
| BILL-06 | Multiple payments | Pay bill in two or more installments. | Already paid and remaining due are correct. |
| BILL-07 | Overpayment block | Enter payment greater than remaining due. | System blocks settlement. |
| BILL-08 | Payment mode | Settle with cash/bank/UPI/card if available. | Payment mode is saved correctly. |
| BILL-09 | Billing pagination | Open billing history with many bills. | Next/Previous works. |
| BILL-10 | Billing refresh | Settle bill, refresh billing history. | Updated bill status remains correct. |

## 6. Accounting

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| ACC-01 | Invoice journal | Create bill. | Journal entry is posted for invoice/receivable. |
| ACC-02 | Payment journal | Settle bill. | Journal entry is posted for payment. |
| ACC-03 | Balanced journal | Inspect generated journal. | Total debit equals total credit. |
| ACC-04 | Tenant chart seeding | Create first bill for fresh tenant. | Required system accounts are created. |
| ACC-05 | Ledger pagination | Create many entries and open ledger. | Pagination works. |
| ACC-06 | Ledger filters | Apply date/account filters. | Ledger reflects selected filters. |
| ACC-07 | Expense entry | Add expense. | Expense appears and accounting impact is correct. |
| ACC-08 | Profit and loss | Compare bill income and expenses. | P&L totals match source records. |
| ACC-09 | Delete account rule | Try deleting system/non-zero account. | Delete is blocked. |

## 7. Reports

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| REP-01 | Reports list | Open reports module. | Reports/patient data loads. |
| REP-02 | Create report | Enter test results for sample/patient. | Report is saved. |
| REP-03 | Verify report | Move completed report to verified. | Status changes only if valid transition. |
| REP-04 | Release report | Release verified report. | Report status becomes released. |
| REP-05 | Invalid transition | Try release before verification. | System blocks action. |
| REP-06 | Report preview | Open report preview. | Patient/test/result data displays correctly. |
| REP-07 | Empty state | Open reports with no data. | No crash; empty state appears. |

## 8. Samples

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SMP-01 | Auto sample creation | Register patient with tests. | Sample records are created. |
| SMP-02 | Sample list | Open samples module. | Samples load with patient and bill details. |
| SMP-03 | Collect sample | Mark pending sample as collected. | Sample status updates; bill item status updates. |
| SMP-04 | Processing sample | Move collected sample to processing. | Status persists. |
| SMP-05 | Reject sample | Reject sample with reason. | Rejection reason is required and saved. |
| SMP-06 | Invalid sample action | Send invalid action. | API rejects action. |
| SMP-07 | Status filter | Filter sample list by status. | Correct samples appear. |

## 9. Inventory

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| INV-01 | Add inventory item | Create item with category/UOM/stock rules. | Item is saved and listed. |
| INV-02 | Duplicate item code | Add item using existing code. | System blocks duplicate. |
| INV-03 | Edit inventory item | Update supplier, stock limits, status. | Changes persist. |
| INV-04 | Low stock indicator | Set stock below reorder level. | Low stock state appears. |
| INV-05 | Search/filter inventory | Search by item/category/status. | Matching records appear. |
| INV-06 | Invalid item update | Update with invalid item ID. | API returns validation error. |

## 10. Quality

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| QLT-01 | Create QC record | Add QC log for test/instrument. | QC record is saved. |
| QLT-02 | QC pass | Mark QC as passed. | Status and notes persist. |
| QLT-03 | QC fail | Mark QC as failed with reason. | Failure reason is saved. |
| QLT-04 | Quality dashboard | Open quality module with data. | Metrics/list load without errors. |
| QLT-05 | Empty quality state | Open quality module without data. | Empty state appears. |

## 11. Tests, Categories, And Packages

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| TST-01 | Create category | Add test category. | Category appears in category list. |
| TST-02 | Create test definition | Add test with price/category/sample type. | Test appears in billing and registration. |
| TST-03 | Edit test definition | Update price/name/status. | Updated values are used in future billing. |
| TST-04 | Create package | Add package with multiple tests. | Package appears in registration/billing. |
| TST-05 | Package billing | Select package in patient registration. | All included tests are billed correctly. |
| TST-06 | Inactive test | Mark test inactive. | Inactive test should not be selectable for new bills. |

## 12. Settings And Users

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| SET-01 | Create user | Admin creates user with role. | User can login and sees allowed modules. |
| SET-02 | Edit user | Change user status/role. | Permission changes apply after next login/session refresh. |
| SET-03 | Role creation/update | Add or modify role permissions. | Role saves and permissions are enforced. |
| SET-04 | Delete assigned role | Try deleting role assigned to users. | Delete is blocked. |
| SET-05 | Non-admin access | Login with limited user. | Restricted settings actions are hidden or denied. |
| SET-06 | Module permissions | Disable a module for tenant/user role. | Related pages/API actions are blocked. |

## 13. Developer / Tenant Management

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| DEV-01 | Create lab/tenant | Developer creates a lab. | Tenant is provisioned successfully. |
| DEV-02 | Edit lab | Update lab information/modules. | Changes persist. |
| DEV-03 | Tenant access | Enable/disable lab access. | Login/access follows the setting. |
| DEV-04 | Defaults page | Update default modules/settings. | Defaults apply to newly created labs. |
| DEV-05 | Developer-only access | Open developer routes as normal tenant user. | Access is blocked. |

## 14. Analytics And Audit

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| ANA-01 | Analytics load | Open analytics page. | Charts/cards load without hook errors. |
| ANA-02 | Analytics date filter | Change date range if available. | Metrics update correctly. |
| AUD-01 | Audit log load | Open audit module. | Audit records load. |
| AUD-02 | Audit event creation | Perform create/update/delete action. | Related audit event is recorded if configured. |
| AUD-03 | Audit filtering | Filter audit by user/module/date if available. | Results match filters. |

## 15. UI And Navigation

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| UI-01 | Desktop responsive check | Test all modules at 1366px width. | No overlap, clipping, or broken layouts. |
| UI-02 | Tablet responsive check | Test all modules at 768px width. | Tables/actions remain usable. |
| UI-03 | Mobile responsive check | Test all modules at 390px width. | Layout stacks cleanly with no horizontal overflow. |
| UI-04 | Loading states | Refresh every module under slow network. | Loading state appears and resolves. |
| UI-05 | Error states | Simulate failed API response. | User sees recoverable error message. |
| UI-06 | Continuous navigation | Move Patients -> Billing -> Samples -> Reports -> Accounts. | Each page receives/loads correct context. |
| UI-07 | Pagination controls | Test paginated pages using first/middle/last page. | Buttons enable/disable correctly and data is correct. |

## 16. API And Data Integrity

| ID | Scenario | Steps | Expected Result |
| --- | --- | --- | --- |
| API-01 | Pagination response shape | Call patient/doctor/billing/accounting/expense APIs. | Response includes records and pagination metadata. |
| API-02 | Search special characters | Search using `+`, `.`, `*`, `(`, `)`. | API does not crash and search is escaped. |
| API-03 | Transaction rollback | Force failure during patient + billing creation. | No partial patient/bill/sample data remains. |
| API-04 | Unauthorized API access | Call protected API without session. | API returns unauthorized response. |
| API-05 | Tenant isolation | Use tenant A session against tenant B record ID. | API blocks or returns not found. |
| API-06 | Invalid ObjectId | Call detail APIs with invalid ID. | API returns validation/not-found response without crash. |

