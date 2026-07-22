# Patient portal - free QR/PIN MVP

## Staff flow

1. Register the patient normally. A separate invited `PatientPortalAccount` is created automatically.
2. Open the patient from the patient list.
3. Select **Print Patient Portal QR**.
4. The system replaces any older activation credential, invalidates older patient sessions, and creates a seven-day single-use access slip.
5. Print the slip and hand it directly to the patient or authorized caregiver.

## Patient activation flow

1. Scan the QR code on the access slip.
2. Enter the printed six-digit access PIN.
3. Confirm the patient date of birth.
4. Choose and confirm a private four-digit portal PIN.
5. The one-time QR token and access PIN are erased, and a separate 30-day HTTP-only patient session is created.
6. The patient opens the mobile portal immediately.

## Returning patient flow

The trusted device remains signed in for up to 30 days. After logout or expiry, the patient signs in using:

- Patient ID printed on the bill
- Date of birth
- Private four-digit portal PIN

Five failed attempts temporarily lock the portal. A newly issued access slip invalidates existing sessions and lets the patient choose a replacement PIN.

## Portal content

- Large mobile-first Home, Reports, and Bills controls
- English/Tamil guidance on entry screens
- Browser read-aloud summary
- Released reports and result parameters only
- Patient-safe bill totals, paid amount, balance, status, and receipts
- Print report action
- Clear instruction to discuss results with a doctor

The patient endpoint uses positive field projections. It never returns referral doctor commission, commission rates, commission journal IDs, pending payouts, accounting journals, staff identities, draft reports, or report version history.

## Security properties

- Separate patient cookie and authentication scope; no tenant staff permissions
- 256-bit random one-time QR token stored only as SHA-256
- Six-digit access PIN and four-digit portal PIN stored with salted scrypt hashes
- Seven-day, single-use activation credentials
- DOB as an additional activation/login factor
- Rate limits and temporary lockout
- Server-side patient ownership derived only from the signed patient cookie
- Released-report-only query
- `private, no-store` medical-data responses
- Portal pages excluded from search indexing
- Portal access audit records
- Reissuing a slip increments `credentialVersion`, invalidating previous sessions

## Operational notes

- Existing patients receive a portal account automatically when staff first issue an access slip.
- The QR library is local; no patient information or activation URL is sent to an external QR service.
- The access slip must be treated as confidential medical-access material.
- Staff should confirm identity before printing or replacing a slip.
