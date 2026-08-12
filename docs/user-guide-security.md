# User Guide — Security

Stage FC-5 (Documentation). Fourth module-family slice of the User
Guide, per FC-5.10's own recommendation. Confirmed directly against the
current repository (`apps/web/app/login/`, `my-security/`, `users/`,
`roles/`, `security/`, `api-gateway/`) that every component named below
still exists exactly as built, rather than assumed unchanged from any
earlier session's own build history for this module family.

Security spans six areas: signing in, an individual's own self-service
security page, an admin's view of another user's account, role/
permission administration, a system-wide security dashboard, and API
key management. Three of the six are entirely self-service (nothing
here needs an entity selected); the rest are system-wide admin
surfaces.

## Signing in

`/login` is a two-step flow. Enter your password first; if your account
has MFA enabled, a second step asks for your six-digit code (with a
"remember this device" option so you aren't asked again on that device
for a while). Without MFA enabled, a correct password signs you in
directly.

## My Security (self-service)

`/my-security` — no entity to select; this page is scoped to *your own*
account via your session, not any Prisma entity record. Everything here
acts on you, not another user:

- **Two-factor authentication** (`EnrollMfaForm`) — a four-step
  enrollment: scan the QR code, enter a code to verify it, then a
  one-time screen of recovery codes. **Save those recovery codes
  somewhere safe immediately** — they're shown exactly once and never
  stored anywhere retrievable, by this app or by you if you navigate
  away first.
- **Active sessions** and **Trusted devices** — see and revoke your own,
  individually.
- **Login history** — a read-only record of your own past sign-ins.
- **Change password** — a settings-style form; unlike most forms in
  this app it doesn't clear itself after saving, since there's no
  "next entry" to prepare for.

## User detail (admin)

Open any user's own detail page from `/users` to administer *their*
account (distinct from the self-service page above, and requiring
admin permissions rather than just being signed in):

- **Roles** (`UserRolesForm`) — a flat checklist of every role in the
  system; check or uncheck, then Save. Saving replaces the user's
  entire role set with whatever's currently checked, not just the
  boxes you changed.
- **Security admin** (`SecurityAdminActions`) — **Unlock account**
  (only offered while the account is actually locked) and **Revoke all
  sessions** (always available, and reports back exactly how many
  sessions it revoked).
- **Active sessions**, **Trusted devices** (each individually
  revocable — unlike sessions, which an admin can only revoke all at
  once), and **Login history** for that user — the same three tables
  the self-service page shows for yourself, here shown for someone
  else.

## Roles & Permissions

`/roles` lists every role in the system (system-wide, no entity to
select) with a quick permission-count/user-count per role. Create a new
role (`CreateRoleForm`) with a code, name, and description.

Open a role's own detail page (`/roles/[id]`) to manage what it can do
(`RolePermissionsForm`) — permission codes grouped by module (GL, AR,
PMO, and so on; there are 190+ codes in the full catalog, too many for
one flat list to be usable). Same pattern as user role assignment:
check what the role should have, Save replaces the whole set.

## Security dashboard

`/security` — system-wide, no entity to select: overall security
posture, MFA adoption, session security, and IP-restriction KPIs and
status badges, all at a glance.

Two administrative forms live here too:

- **Password policy** (`PasswordPolicyForm`) — the one, global
  password policy for the whole system (minimum length, complexity
  rules, expiry). A settings form like Change Password above — it
  shows the current configuration and doesn't clear on save.
- **IP rules** (`CreateIpRuleForm`, then `DeactivateIpRuleButton` per
  row) — allow or block a specific IP, scoped either globally or to one
  user. Deactivate a rule you no longer need directly from its own row.

## API Gateway (API keys)

`/api-gateway` — generate a new API key (`GenerateApiKeyForm`): name it,
and the finished key is returned and shown to you exactly once.
**Copy it immediately** — like MFA recovery codes, this app never
stores or re-displays the plaintext key anywhere, by design; only a
hash is kept server-side, the same as a password.
