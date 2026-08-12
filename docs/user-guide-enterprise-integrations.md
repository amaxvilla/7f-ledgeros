# User Guide — Enterprise Integrations

Stage FC-5 (Documentation). Eighth module-family slice of the User
Guide, per FC-5.12's own recommendation. Confirmed directly against the
current repository (`apps/web/app/integrations/`, `payments/`,
`bank-integration/`, `signatures/`, `power-bi/`) that every component
named below exists as described — read fresh this checkpoint, not
assumed from this document's own earlier module-family slices.

This module family has two layers, and it's worth understanding the
split before using either: **`/integrations`** is a generic connector
registry — register a provider, store its credentials, run a health
check — that covers every integration category this app knows about.
**`/payments`, `/bank-integration`, `/signatures`, and `/power-bi`**
are separate, dedicated pages that actually *do* something with four
of those categories. A provider can be registered in the first layer
without having any second-layer page at all — see "What's registry-only"
below.

## Integrations registry

`/integrations` — system-wide, not entity-scoped (most providers have
no entity of their own). Register a provider (`CreateIntegrationForm`)
by picking a category — Microsoft Graph, Google Workspace, SMS,
WhatsApp, Power BI, Digital Signature, Payment, Banking, API Gateway,
Storage, Email, or Other — and giving it a free-text provider code
(e.g. `TWILIO`); the code isn't a fixed list, since the category is
what the backend actually keys behavior on. Each row shows a status
badge and whether a health check has ever run — "Never checked" is a
distinct state from a failed check, not the same as unhealthy.

Click **Manage** on a row to open its own detail page
(`/integrations/[id]`), where you can:

- **Update settings** (`UpdateProviderForm`) — name, active flag, retry
  behavior, and the provider's own `config` object, edited as a list of
  key/value rows rather than raw JSON (every real config example in
  this app — bucket name, region, sender address — is a flat set of
  string pairs, so that's the input shape offered).
- **Rotate credentials** (`RotateCredentialsForm`) — always starts
  blank. Credentials are write-only: once saved, this app never
  displays them again, anywhere, not even redacted — the detail page
  only shows a plain "Has credentials: yes/no" badge next to the form,
  so you always know whether you're setting credentials for the first
  time or replacing existing ones, without ever being shown what the
  existing ones are.
- **Run a health check**, from either the registry list or the detail
  page.

## What's registry-only

Microsoft Graph, Google Workspace, SMS, and WhatsApp can all be
registered and health-checked above — but none of them has its own
functional page in this app. There's no "browse Workspace files," no
"send an SMS," no "send a WhatsApp message" screen anywhere. The one
place SMS/WhatsApp appear outside the registry is as filter options on
the notifications log (`/notifications`) — filtering already-sent
notifications by channel, not sending a new one. If your work needs to
actually use one of these four, it isn't reachable through this
application's UI today, even though the connector can be configured.

## Payments

`/payments` — entity-scoped. Create a payment link
(`CreatePaymentLinkForm`) against one of two concrete providers
(Paystack or Flutterwave — a real, currently-fixed set, not every
possible provider), enter an amount in your normal currency units; the
form converts it to the minor-unit integer (kobo, cents) the backend
requires. The transaction table and KPI figures below likewise show
amounts converted back from minor units for display — this conversion
is specific to this one page, not part of how money is shown anywhere
else in the app.

## Bank Integration (Mono)

`/bank-integration` — entity-scoped. Link a bank account to Mono
(`LinkMonoAccountForm`) by picking one of your entity's own bank
accounts and supplying the one-time consent code Mono's own Connect
widget produces — this app doesn't embed that widget itself, so you'll
need to obtain the code through Mono directly and paste it in here.

The page highlights two situations that need attention separately from
the main list: accounts whose linkage **needs reauthorization**, and
accounts that are still marked active but haven't synced in a while
(**stale**). **Revoke** is available on any linked account that isn't
already revoked.

## Digital Signatures

`/signatures` — a register of manual signature envelopes, system-wide
(envelopes have no entity of their own). There's no "create an
envelope" form on this page by design: envelopes are created by
sending a document for signature elsewhere in the app, not from this
register directly. From here you can **Decline** an envelope that's
still outstanding (declining one that's already completed, declined,
or voided is rejected). There's no way yet to upload the countersigned
copy once a signature completes — that's a real, separate piece of
work (a file upload flow) this app doesn't have.

## Power BI

`/power-bi` — no list, no register, because there's nothing local to
list: this integration keeps no database records of its own. The page
is three direct action forms instead — **Publish dataset**, **Push
rows**, and **Refresh and embedding** — each one calling straight
through to Power BI itself.

The "Refresh and embedding" form is the one place in this entire
application with a genuinely interactive, embedded report, not just a
link or a raw token printed as text — it uses Microsoft's own official
embedding library to render the report in place, the only third-party
JavaScript library used anywhere in this app's frontend for something
like this. Everywhere else, this app deliberately avoids adding
runtime dependencies for things a plain HTML element can already do;
this is the one confirmed exception, because an interactive,
access-controlled Power BI report genuinely can't be embedded with a
plain `<iframe>`.
