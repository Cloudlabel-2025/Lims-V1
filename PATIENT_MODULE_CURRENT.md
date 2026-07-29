# Current Patient Module

## 1. Purpose

The Patient module manages patient registration, patient search, patient profile viewing, patient editing, visit history, and repeat-visit billing from one place.

It is the starting point for most lab workflows because every bill, sample, test report, and visit must be connected to a patient record.

## 2. What This Module Does

The current Patient module allows lab staff to:

- Register a new patient with demographic, contact, barcode, UH ID, sample timing, report type, referring doctor, and selected investigations.
- Automatically generate a patient ID after successful registration.
- Search patients by name, phone number, patient ID, or barcode.
- Filter patients by gender and age range.
- View patients in grid or list format.
- Open a patient sidebar for quick patient details.
- Edit existing patient details.
- Delete a patient if the logged-in user has delete permission.
- View a patient's previous visits using billing records.
- Create a new visit for an existing patient by selecting tests or packages and generating a new bill.

## 3. Main Users

- Front desk staff
- Receptionist
- Lab administrator
- Billing staff
- Lab manager
- Authorized users with patient permissions

## 4. Key Features

### Patient Registration

The registration screen captures:

- Patient name
- Date of birth
- Auto-calculated age
- Gender and gender identity when applicable
- Mobile number
- Address
- UH ID
- Barcode
- Report type: Hand or Digital
- Collection time
- Received time
- Referring doctor, when available
- Selected tests or packages

The system validates required fields before saving. It checks mobile number format, date rules, UH ID format, barcode format, address safety, and timing rules.

### Patient ID Generation

The system creates a patient ID automatically using a counter-based format.

Current format:

```text
{patientPrefix}PS-0000001
```

If no tenant-specific prefix is supplied, the default prefix is `PT`.

### UH ID Handling

The module requires a 14-character alphanumeric UH ID.

Benefit:
UH ID gives the lab another strong identifier apart from patient ID, phone, and barcode.

### Barcode Handling

The registration form requires a barcode. The UI formats the barcode while typing, and the API validates that only allowed characters are used.

Benefit:
Barcode support reduces manual lookup mistakes and prepares the patient flow for sample tracking.

### Duplicate Patient Warning

When registering a patient, the system checks whether the same mobile number already exists.

If a match is found, the user gets a duplicate warning and can either cancel or proceed intentionally.

Benefit:
This helps reduce accidental duplicate patient records while still allowing real-world cases where the same phone number may be shared by family members.

### Patient List

The patient list supports:

- Paginated patient records
- Search
- Gender filter
- Minimum age filter
- Maximum age filter
- Grid view
- List/table view
- Refresh action
- Empty state
- Permission-based create/delete actions

Benefit:
Staff can quickly find returning patients and avoid re-registering them.

### Patient Sidebar

When a patient is selected from the list, a sidebar opens with patient information.

Benefit:
The user can quickly inspect patient details without leaving the patient list.

### Edit Patient

Authorized users can edit patient details. The API protects immutable fields such as patient ID, internal ID, and created date from being changed.

Benefit:
Correction of wrong patient details is possible while protecting system-generated identity fields.

### Delete Patient

Authorized users can delete a patient from the patient list.

Current behavior:
The API uses hard delete through `findByIdAndDelete`.

Important note:
Soft delete and recovery are not yet implemented for patients.

### Visit History

The visit history page shows billing records connected to a patient.

It displays:

- Bill ID
- Date and time
- Number of tests
- Total amount
- Billing status
- Priority

Benefit:
The lab can see repeat visits and past billing activity without searching across the billing module manually.

### New Visit For Existing Patient

For an existing patient, staff can create a new visit by selecting tests or packages.

The new visit screen includes:

- Existing patient details
- Priority: routine or urgent
- Collection time
- Received time
- Tests/packages
- Discount percentage
- Tax percentage
- Notes
- Net payable calculation

On submit, the system creates a new billing record.

Benefit:
Repeat patients do not need to be registered again. Staff can directly create a new bill for a new visit.

## 5. Business Benefits

The Patient module helps the lab by:

- Keeping patient information centralized.
- Reducing duplicate records.
- Speeding up repeat patient handling.
- Connecting patient data with billing, samples, and reports.
- Making patient search faster for front desk users.
- Improving traceability through patient ID, UH ID, phone, and barcode.
- Supporting visit history for better patient service.
- Reducing manual mistakes through validation.
- Enforcing role-based permissions for patient access and actions.

## 6. Connected Modules

### Billing Module

The Patient module is directly connected with billing.

During new patient registration, selected tests/packages can automatically create a bill. For existing patients, the New Visit screen creates a new billing record.

### Test Master Module

The registration and new visit screens load active tests and packages from the Test Master module.

This allows staff to select investigations while registering a patient or creating a repeat visit.

### Doctor Module

The registration screen can load active doctors and attach a referring doctor name to the patient.

This supports referral tracking and future commission/accounting workflows.

### Sample Module

Patient registration captures collection and received time. Billing creation can later connect the patient to generated samples.

### Reports Module

Reports are connected to patients through billing, samples, and test reports.

The patient record becomes the base identity for report generation.

### Dashboard Module

Patient registration and billing updates clear cached dashboard stats so dashboard counts can stay current.

### RBAC / Settings Module

Patient actions are controlled through permissions:

- `patients.view`
- `patients.register`
- `patients.edit`
- `patients.delete`

## 7. Current API Coverage

Current patient APIs include:

- `GET /api/patient`
- `POST /api/patient`
- `GET /api/patient/[id]`
- `PUT /api/patient/[id]`
- `DELETE /api/patient/[id]`
- `GET /api/patient/[id]/billing`

## 8. Current Pages

Current patient pages include:

- `/patients`
- `/patients/register`
- `/patients/edit/[id]`
- `/patients/[id]/visits`
- `/patients/[id]/new-visit`

## 9. Current Data Stored

The current patient model stores:

- Patient ID
- Full name
- Date of birth
- Age
- Gender
- Gender identity
- Phone
- Address
- Email
- UH ID
- Collection time
- Received time
- Referring doctor name
- Report type
- Barcode
- Created and updated timestamps

## 10. Current Gaps / Pending Improvements

The current Patient module is functional, but these improvements are still pending or important:

- Replace hard delete with soft delete.
- Add patient restore/recovery flow.
- Prevent deletion when patient has linked bills, samples, or reports.
- Move automatic billing creation fully into the billing/order flow if patient registration should stay clean.
- Add stronger duplicate matching using name, phone, age, and UH ID together.
- Add patient detail page if the sidebar is not enough.
- Add export option for patient list if required.
- Add audit log entries for patient create, update, and delete.
- Add tenant-configurable patient numbering if required by lab policy.

## 11. Summary

The current Patient module works as the main patient identity and registration center of the LIMS.

It supports new patient registration, patient search, patient editing, visit history, and repeat visit billing. Its biggest business value is that it keeps patient identity consistent across billing, samples, reports, doctors, and dashboard workflows.

