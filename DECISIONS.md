# Owner decisions log

The running record of decisions the owner has made for the Bundu ecosystem,
newest first. Each entry says what was decided, quotes the owner where the
wording matters, and links the issue or pull request where the work is
tracked. Detail and discussion live in those issues; this file is the index
an agent or person reads first to find out what has already been decided.

How to add an entry:

- Add it under the date the owner made the decision, at the top.
- Quote the owner verbatim when the exact words carry the decision.
- Link the tracking issue in the repository that owns the work.
- When a later decision replaces an earlier one, edit the earlier entry to say
  **Superseded** and link the newer one. Never delete an entry.
- This repository is public: no secrets, credential status, internal hostnames
  or exploitable detail.

## 2026-10-25

### Verification ownership

- **Mukoko Verify** (verify.mukoko.com, `mukoko-dev/mukoko-verify`) is owned by
  the Kweli workstream, under the mission's ownership: Kweli is Mukoko's trust
  and verification layer. Verification checks start and are paid for there.
- **The Nyuchi Pay wallet debit** for a verification fee is built in
  `nyuchi/nyuchi-api` by the infrastructure workstream.
- The handoff: Kweli defines the call that opens a verification case (subject,
  target assurance level, price quote); the infrastructure side then wires the
  wallet debit to it. Tracked in nyuchi/nyuchi-api#375 and mukoko-dev/kweli#235.

### Verification pricing

- Owner: "$10 for the government check everything else is free."
- Owner: "We run on a parrellel to the Chinese yuan." Nyuchi Pay prices are
  anchored in CNY. The government check is **CNY 70**.
- Prices in other currencies are derived from the CNY anchor at the current
  exchange rate, then **truncated to a clean whole amount, never rounded up**
  (CNY 70 is about USD 9.85, so it is charged as USD 9).
- Exchange rates: an exchange-rate provider interface, refreshed hourly; a rate
  older than 24 hours is refused. The RBZ interbank rate is used for ZWG and a
  market rate for USD. A quote records the anchor, rate, source and time, holds
  for 15 minutes, and is copied onto the order and the charge. An expired quote
  means a fresh quote, never a silent re-price.
- **The government check is valid for 5 years** (owner: "The government check
  sorry is 5 years"). Expiry lowers the assurance level unless it is renewed;
  reminders go out 60, 30 and 7 days before. Renewing opens a new case.
- **The expert (licensed) check renews yearly.** Its price is undecided, and it
  is not for sale until the owner sets one.
- Everything else is free: no level, OTP, documented, and the community,
  business and domain attestations.
- Tracked in nyuchi/nyuchi-api#375.

### The verification model

- The canonical model is assurance levels plus attestations, the same for
  persons, entities and places (`gateway/lib/assurance.py` in nyuchi-api):
  - levels, ordered: 0 none, 1 OTP, 2 documented, 3 government, 4 licensed
    (the expert tier);
  - attestations, held alongside the level: community, business, domain.
- `bundu.verificationTier` is the derived legacy projection (0 unverified,
  1 community, 2 OTP, 3 government, 4 licensed), kept until every reader has
  moved. Every tier change goes through `assurance_writer` and is recorded in
  `entity.verifications`.
- Mzizi carries the model as tokens and components (registry 4.17.0). Kweli's
  tier ladder, gates and analytics move to it next.

### Owner attestation for the ecosystem's own entities

- Owner: "Bundu commons is a system entity. It is under the Bundu foundation.
  Moses and nyuchi and Bundu foundation and Mukoko lingo are all at stage 3. I
  am the owner so they should all be at that level and Moses adventures is at
  tier 4, Nyuchi Africa is at tier 4."
- Targets: Nyuchi Africa 4, Moses Adventures 4, Bundu Foundation 3, Bundu
  Commons 3 (a system entity under the Bundu Foundation), Mukoko Lingo 3.
  Each is written through `assurance_writer` with a verification record that
  quotes the owner. Tier 4 for Nyuchi Africa rests on owner attestation until a
  licence is on file.
- The approval covers these five entities only. Organisations imported from
  OpenStreetMap that show tier 2 with no verification record need their own
  correction plan before anything is written.

## 2026-10-24

### Payments

- Owner: "Everything is porting to Astro with a rust backend. Our payments run
  on nyuchi pay our own custom checkout. But mzizi is not an internal
  architecture it's also public so mzizi should never limit to our providers.
  We need to build out our payment framework and ui and backend fully.
  Commerce runs through bushtrade."
- Owner: "Nyuchi Pay will handle EcoCash and cards, and as we expand other
  payment providers across Africa and other merging markets."
- Owner: "Paynow is limited to only zimbabwe and we not even use paynow it gets
  listed as one of the payment options for zimbabwe. We run our own wallet."
- What follows from these:
  - **The Nyuchi Pay wallet is the core.** Charges settle against its ledger.
    Payment providers are per-country options for paying in and out, and
    Paynow is one option listed for Zimbabwe.
  - **Mzizi stays provider-neutral.** Its payment contracts and components take
    a provider interface, and the Rust trait lives in Mzizi.
  - **Launch currencies are USD, ZWG and CNY** (owner: "Nyuchi pay starts with
    usd, ZIG, and Chinese yuan"). CNY can be priced, but can't be paid until a
    CNY payment provider is connected.
- **API layout.** Owner: "commerce is it own name space, pay is its own." In
  nyuchi-api, `/v1/commerce` holds the catalogue, plans, orders, subscriptions
  and entitlements. `/v1/pay`, named "the Nyuchi Pay API", holds charges,
  payment methods and connectors. Commerce calls Pay only through Pay's public
  interface.
- Each app hosts its own checkout against the Nyuchi Pay API to start.
- Subscriptions live in a separate Postgres `commerce` schema; the catalogue
  stays in MongoDB.
- Tracked in nyuchi/nyuchi-api#375, with mzizi-dev/mzizi-registry#569,
  mukoko-dev/kweli#235 and the bushtrade issue #94.

### `@nyuchi/ui` becomes the B2B layer

- The Svelte versions of `@nyuchi/ui` are retired. Owner: "We do not use svelte
  this is already out of any build decisions."
- `@nyuchi/ui` 1.0 is repurposed for nyuchi's B2B SaaS apps: dashboards,
  settings, team management and billing. Owner: "Pulling from Mzizi": it only
  composes Mzizi and `@bundu/ui`, with no fork and no local components.
  Anything missing goes upstream first.
- The first app is the **Kweli business dashboard** (owner: "Kweli business
  dashboard first"). Publishing 1.0.0 needs the owner's direct approval and a
  manual major-version release.
- Tracked in mzizi-dev/packages-npm#79.

### Design system

- Owner: "All of the design gaps need to be filled that should be something
  that is really basic. You should not need approval for that. Mzizi is the
  rule. Do not drift from it."
- Verification tier colours, all on Mzizi's `--tier-*` tokens:

  | Tier | Name             | Colour                       |
  | ---- | ---------------- | ---------------------------- |
  | 0    | Unverified       | neutral (`--status-neutral`) |
  | 1    | Community        | terracotta                   |
  | 2    | Contact Verified | cobalt                       |
  | 3    | Government       | gold                         |
  | 4    | Licensed         | tanzanite                    |

  The proposed colours for the newer attestations are sodalite (documented),
  malachite (business) and copper (domain), subject to the contrast check.

- Each Bundu pillar has its own colour, each mini-app has its own variant, and
  the heritage colours are used across status and other shared roles.
- Tracked in mzizi-dev/mzizi-registry#543.

### Security

- Owner: "Please fix all the remaining security issues." The six follow-ups
  from mzizi-dev/mzizi-registry#502 were fixed in #567 and released in registry
  4.16.0.

### The ecosystem `.github` repositories

- The owner's mission brief is in the `AGENTS.md` of every org `.github`
  repository: nyuchi, mzizi-dev, mukoko-dev, shamwari-ai, bundu-labs, openNTL
  and siafuDB. It covers the ecosystem, the four gateways, the engineering bar
  and the dependency policy.
- **Dependencies:** first-party packages and direct dependencies take a minimum
  version only. Third-party packages known to break across majors, and the
  runtime dependencies of published packages, are capped within their major.
- **Dependency review:** a high or critical advisory blocks a pull request only
  while a newer release of that package exists (#118). Five vite advisories
  that only affect vite-plus's alias are allowed (#121).
- **Releases** go `staging` → `main` through the merge queue as squash merges.
  Dependabot targets `staging`, with a 7-day cooldown. The org `.github`
  repositories carry `AGENTS.md` only, with no `CLAUDE.md` or `.claude/`.

## Open decisions

- The price of the expert (licensed) check.
- Which CNY payment provider to use, and the merchant entity behind it.
- Where each currency settles, whether CNY converts on payout, how long ZiG is
  held, VAT, and the Chinese payment and data rules (PBOC, PIPL). These need
  counsel.
- Terms of sale and the refund policy, before the first charge.
- Who issues internal tokens for the Nyuchi Servers API.
