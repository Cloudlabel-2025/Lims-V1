# Doctor portal

## Staff flow

1. Open **Doctors > Add New Doctor**.
2. Enter the doctor profile, including a unique registered email address.
3. Submit the registration. The server validates the doctor details and confirms that the active `Doctor Regular` role exists.
4. The system creates the doctor profile and linked invited tenant `User` together in a database transaction.
5. The linked user receives the `Doctor Regular` role and an explicit `User.doctorId` relationship.
6. The system sends a lab-branded activation email containing the tenant login information, six-digit OTP, activation URL, and expiry time.
7. If delivery fails, the doctor and portal account remain created. Open the doctor details sidebar and select **Resend portal invitation**.

Resending an invitation generates a new OTP and invalidates the previous invitation credential.

## Doctor activation flow

1. Open the activation URL received by email.
2. Confirm the registered email address and lab ID.
3. Enter the six-digit activation OTP.
4. Choose and confirm a password that satisfies the system password policy.
5. The invited account becomes active.
6. The single-use OTP and expiry fields are cleared.
7. The doctor can now sign in through the lab tenant login page.

## Returning doctor flow

The doctor signs in using:

- Registered email address or assigned user ID
- Doctor-created password
- Correct laboratory tenant login page

After authentication, the system reads the explicit `User.doctorId` relationship, verifies that the linked doctor profile is active, and redirects the doctor to `/doctor/dashboard`.

Repeated failed login attempts trigger the existing tenant-account rate limits and temporary lockout. Password recovery uses the standard secure email OTP flow.

## Portal content

- Dashboard totals for referred patients and released reports
- Referral patient list with patient ID, contact information, referral date, bill, tests, payment state, and commission state
- Referral patient details and visit history
- Released laboratory results and result parameters only
- Estimated commission for referrals that are not yet eligible
- Earned commission for eligible paid referrals
- Current pending payout
- Completed payout history and accounting reference
- Doctor profile and permitted profile editing
- Secure tenant logout

The portal derives the doctor identity from the signed session. It does not accept a browser-supplied doctor ID as trusted ownership information.

## Security properties

- One portal user per doctor through a sparse unique `User.doctorId` index
- Doctor and portal-user email duplicates rejected during registration
- Invited accounts cannot sign in before choosing a password
- Six-digit OTP stored only as a SHA-256 hash
- 24-hour, single-use activation invitation
- Previous OTP invalidated when an invitation is resent
- Server-side referral ownership checks on patient, billing, and report requests
- Unauthorized patient and report lookups return `404` to avoid disclosing record existence
- Draft, reviewed, and approved reports are hidden from doctors
- Only released reports are returned to doctor sessions
- Inactive doctor profiles are denied login even when the linked user remains active
- Doctor navigation is restricted to the doctor portal and profile
- Login, report access, registration, and invitation actions use the tenant audit system

## Operational notes

- Tenant RBAC must contain an active role named `Doctor Regular`.
- Existing tenants should run the RBAC seed if this role is missing.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` before sending invitations.
- Configure the root domain and tenant subdomains so activation URLs are externally reachable.
- The doctor email address must be unique within the tenant database.
- Changing a doctor's email should be handled as a verified account change rather than silently changing login ownership.
- Making a doctor inactive immediately prevents portal login.
- Commission rates are captured on referral bills; changing the doctor's current rate must not rewrite historical commissions.
- Commission settlement and payout release remain staff-controlled accounting operations.
- If an invitation email fails, use **Resend portal invitation** rather than manually creating another user.
