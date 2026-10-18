"use strict";

/**
 * Seed the "Felons Melon Ethical Launch" box: seven draft decks.
 *
 *   node scripts/seed-ethical-launch-box.js
 *
 * This is the warboard -> deck step from the modified plan, with one addition:
 * DECK-06 (the revenue + UPL boundary) because an ethical plan without a
 * business model walks away from the $100 bill.
 *
 * Decks are left as DRAFTS on purpose. The app's rule is that a human reviews
 * all four files and presses "Confirm & Lock". This script never locks, never
 * ships, and writes only inside the app data root.
 */

const path = require("node:path");

const { WarboardStore } = require("../src/core/store");

const APP_ROOT = path.resolve(__dirname, "..");
const BOX_TARGET = 8;

const DECKS = [
  {
    title: "DECK-00 — SparkPost System Forming",
    notes: `# sparkpost system forming

What exists right now, honestly:
- cockpit (sparkpost-cockpit) with a read-only TRUTH pane — verified, 14 tests
- RAP live openings — 5 robots-cleared feeds, 273 pulled, 30 ranked, Remotive refused
- role membrane — one harness, roles per call, projection-enforced boundaries
- warboard-box desktop app — NEON-90, decks/boxes, 46 tests, security gate
- recursive security program — self-hashing scanner, baseline chain, 20 mutation tests
- GitHub repo prepared locally as a fast-forward; push still pending (Kirk's credential)

Open edges:
- repo push not done; visibility decision pending
- Tailscale installed but tailscaled not running
- credentials rotation still the #1 gate
- PINS context still not uploaded

This deck is the inventory of the machine, so the ethical-launch decks can point at something real instead of a promise.`,
    readme: `# DECK-00 — SparkPost System Forming

## Purpose

Inventory the working machine — what is built, what is proven, and what is still an open edge — so every ethical-launch decision is anchored to infrastructure that actually exists.

## What this deck is

The baseline deck for the box. It records the state of the compound at the moment the business plan was written: the cockpit, RAP, the role membrane, Warboard Box, the recursive security gate, and the repo.

## What is proven

- **Cockpit TRUTH pane**: 14/14 read-only tests, live read of pair, canon, RAP, gates.
- **RAP live openings**: 273 listings pulled / 30 ranked in 1.3 s; Remotive refused by robots.txt; fail-closed sample fallback.
- **Role membrane**: one harness, role-per-call; forbidden context removed before the prompt exists; 19 tests at build time.
- **Warboard Box**: 16 core tests + 10 wiring tests; security gate; deck/box rules enforced in the store.
- **Recursive security**: 20 mutation tests; tamper demo failed the gate, restore passed.
- **Repo**: local commit + scaffold merge; fast-forward-ready; CI workflow defined.

## What is not proven

- Nothing has touched a real user yet.
- Push, Tailscale service, credential rotation, and the PINS lane are open.
- The window has not been visually verified by the build agent.

## Why it matters

The ethical launch is only credible if the system underneath it is real and inspectable. This deck is the evidence that it is.

## Source

See 01-source-notes.md for the raw state dump and 03-actions.md for the verification checklist.
`,
    structured: `# DECK-00 structured — SparkPost System Forming

## Component status

| Component | State | Evidence |
|---|---|---|
| Cockpit TRUTH pane | Live, read-only | /api/truth 200, 14 tests |
| RAP live openings | Built, staged | 5 feeds, 273 pulled, 30 ranked |
| Role membrane | Built, staged | projection tests, 19 at build |
| Warboard Box | Built, running locally | 16 core + 10 wiring tests |
| Recursive security | Gating | 20 mutation tests, baseline chain |
| GitHub repo | Prepared, not pushed | commit a7b76a6 + merge 77a2598 |

## Invariants the machine already enforces

1. No deck locks without four complete files and human review.
2. No incomplete deck ships.
3. Shipping is a dated copy with SHA-256 per file.
4. Security gate fails closed before launch and tests.
5. Forbidden context never reaches the wrong role.

## Open edges

- Push needs Kirk's credential prompt; repo is public until he decides.
- tailscaled is not running; remote view is local-only today.
- Credential rotation is still the project's #1 gate.
- PINS = Pinterest lane waiting on account/domain/tag/landing/graphics.

## Difference between this deck and a status report

A status report can be optimistic. This deck is the box's foundation: if a claim here is false, the ethical-launch decks above it are marketing.
`,
    actions: `# DECK-00 actions — SparkPost System Forming

- [ ] Run node security/run.js --gate and confirm zero HIGH findings
- [ ] Run the three test files and record counts in this deck
- [ ] Push the prepared commit to GitHub after deciding visibility
- [ ] Start tailscaled and prove the read-only remote view over tailscale serve
- [ ] Rotate the credentials before any real user touches the system
- [ ] Re-read every "proven" claim above and mark anything that is actually a plan
`,
  },
  {
    title: "DECK-01 — Entity Membrane & Brand Firewall",
    notes: `# entity membrane

Bradford Auto Solutions LLC is the liability container. Three brands:
- Felons Melon (justice-impacted users)
- KinloaSlate (consumer protection marketing; auto repair now, parts later)
- SparkPost (the engine; no user-facing brand)

Each brand gets a data firewall, not a legal entity separation. The membrane built for Sparky/Nikola/Harbor is the template: strip context at the projection layer before any cross-brand call.

Hard rule: Felons Melon data never flows into KinloaSlate marketing. KinloaSlate data never touches Felons Melon narratives. A user who came for arrest help never gets a car-repair email.

Legal floor: one LLC with DBAs is fine at this stage. Revisit separate entity only if narratives enter court-adjacent contexts at volume.
Ethical ceiling: the user's context is sacred to the brand they trusted.

Open: DBAs must be registered and reflected in the privacy notice; physical address unresolved.`,
    readme: `# DECK-01 — Entity Membrane & Brand Firewall

## Purpose

Define how one LLC runs three brands without letting one brand's user data leak into another brand's marketing, and enforce it in code rather than in a policy document.

## Structure

Bradford Auto Solutions LLC
- **Felons Melon** — justice-impacted users; narratives, reentry worksheets, arrest context; consent per narrative with deletion.
- **KinloaSlate** — consumer-protection marketing (auto repair, later parts); complaints, reviews, inquiries; email opt-in.
- **SparkPost** — the engine; operational logs and send records; sees all brands, exposes no brand's users to another.

## The firewall rule

Felons Melon data never flows into KinloaSlate marketing. KinloaSlate data never touches Felons Melon narratives. The projection layer strips brand context before any cross-brand API call, exactly as it strips shame/charge/substance keys before Nikola sees them.

## Legal floor

- One LLC with DBAs is appropriate at this stage.
- Do not separate entities yet; it is expensive and premature.
- Revisit if narratives are used in court-adjacent contexts or data volume grows materially.
- DBAs must be registered and named accurately in every privacy notice and email footer.

## Ethical ceiling

A person who came to Felons Melon for arrest help must never receive a KinloaSlate marketing message. Ever. The firewall is absolute because the trust is vertical: the user trusted one brand, not the parent company.

## Enforcement

The membrane returns nothing when asked for cross-brand context. A policy can be forgotten; a projection that drops the key cannot.
`,
    structured: `# DECK-01 structured — Entity Membrane & Brand Firewall

## Brand map

| Brand | Users | Sensitive data | Membrane roles | Cross-brand access |
|---|---|---|---|---|
| Felons Melon | justice-impacted | narratives, arrest context | Sparky, Harbor, Nikola | none |
| KinloaSlate | consumers | complaints, reviews, inquiries | Nikola (commercial) | none |
| SparkPost | internal | logs, send records | none user-facing | sees all, exposes none |

## Firewall rules (enforced at projection)

1. narrative, arrest_context, worksheet_response are Felons Melon-only keys.
2. KinloaSlate context never includes them; the projection strips them by name.
3. No cross-brand email or SMS may be triggered from Felons Melon consent.
4. Consent is per brand and per purpose; one does not imply the other.

## Legal notes

- LLC with DBAs is the floor. Entity separation is not required now.
- DBA registration and accurate naming in notices/footers is required.
- Physical address must be real and current before any commercial email.

## Failure modes this prevents

- The "one CRM" mistake: a single contact table that quietly joins brands.
- The "helpful cross-sell" mistake: offering a car-repair service to a recent arrestee.
- The "parent company" mistake: naming Bradford Auto Solutions in a Felons Melon marketing email in a way that breaks the trust.

## Open decisions

- Exact DBA registration state and filing numbers.
- Whether SparkPost ever exposes aggregate (not individual) cross-brand metrics; default is no.
`,
    actions: `# DECK-01 actions — Entity Membrane & Brand Firewall

- [ ] Confirm DBA registrations for Felons Melon and KinloaSlate under Bradford Auto Solutions LLC
- [ ] Resolve the physical postal address to be printed in every commercial email
- [ ] Implement the brand-context key list as a projection rule in the membrane
- [ ] Add a test that KinloaSlate context cannot read Felons Melon narrative keys
- [ ] Write one sentence of plain-language user promise for each brand's privacy notice
- [ ] Legal review: confirm one-LLC-with-DBAs structure for this stage
`,
  },
  {
    title: "DECK-02 — Email Capture & Worksheet Delivery",
    notes: `# email capture and worksheet delivery

Offer: a free reentry worksheet emailed to someone recently arrested. Variants until we know what works. This is the lead magnet and the help; the narrative is the deeper product.

Landing page: one job. Hero, email field, consent line, submit "Send my worksheet", privacy link, what happens next. Email stored with source, timestamp, ip, consent text shown. SparkPost template reentry-worksheet-v1..v5. Suppression checked before send. Send logged in EMAIL_LEDGER.

CAN-SPAM floor: no deceptive subject/header, valid physical address, clear unsubscribe, honor within 10 business days (we code instant + 3-day manual SLA), no sending to opted-out, no harvested/dictionary addresses.

Platform layer is stricter: SparkPost AUP wants opt-in. The form submission IS the opt-in.

Worksheet variants:
v1 first 48 hours after arrest
v2 talking to your attorney
v3 telling your family
v4 keeping your job through court
v5 court date preparation

Follow-up: day 2 did it help, day 7 more resources, day 14 check-in, then monthly. Same footer and unsubscribe on every send.`,
    readme: `# DECK-02 — Email Capture & Worksheet Delivery

## Purpose

Specify the first real touch: a free, genuinely useful reentry worksheet delivered by email to someone who just asked for it, with compliance and honesty built into the template rather than bolted on.

## The offer

Free reentry worksheet. No account. No spam. One field, one button: "Send my worksheet." The worksheet is the help, not a teaser for a paid product.

## Landing page structure

1. Hero: "Arrested recently? Get the free reentry worksheet."
2. Consent line above the field: "Free worksheet. No spam. Unsubscribe anytime."
3. Email field + "Send my worksheet" button.
4. Below: "By submitting, you agree to receive occasional reentry resources from Felons Melon. See our privacy notice."
5. Privacy notice linked and on-page.
6. Confirmation: check inbox in 5 minutes, check spam, unsubscribe link works.

## System view

Store: address, source "fm-landing", timestamp, IP if used for state detection, consent text shown. Trigger SparkPost template. Check suppression before send. Log to EMAIL_LEDGER (address hash, template, timestamp, status).

## Worksheet variants

- v1 — the first 48 hours after arrest
- v2 — talking to your attorney
- v3 — telling your family
- v4 — keeping your job through court
- v5 — court date preparation

Each variant is a different worksheet, not a different manipulation strategy.

## Compliance floor (CAN-SPAM, real version)

- No deceptive subject line or header.
- Valid physical postal address in every commercial email.
- Clear, conspicuous unsubscribe.
- Honor unsubscribe within 10 business days; we do instant automated, 3-day manual SLA.
- Never email someone who opted out.
- Never use harvested or dictionary-generated addresses.

## Platform layer

SparkPost's AUP likely requires opt-in even where CAN-SPAM does not. The form submission is the opt-in. We are above both floors.

## What never happens

No email to someone who did not request it. No KinloaSlate topic. No missing address. No missing unsubscribe. No send to a suppressed address. No "test" send without the compliant footer.
`,
    structured: `# DECK-02 structured — Email Capture & Worksheet Delivery

## Flow

1. Visitor lands on felonsmelon.com.
2. Reads offer + consent line; enters email; presses "Send my worksheet".
3. System records consent evidence and triggers the template.
4. Suppression list is checked before send.
5. Worksheet is delivered within minutes; send is logged.
6. Follow-ups: day 2 (did it help), day 7 (resources), day 14 (check-in), then monthly.
7. Every message carries address, unsubscribe, honest header.

## Data captured

| Field | Why | Retention |
|---|---|---|
| email | deliver worksheet + occasional resources | until unsubscribe or deletion |
| timestamp | consent evidence | retained with consent record |
| consent_text_shown | prove what was agreed | retained with consent record |
| IP | only if needed for state detection — prefer asking state | minimize; drop if not needed |
| source | "fm-landing" | retained |

## Message-type matrix

| Message | Class | Required |
|---|---|---|
| worksheet delivery | commercial | full CAN-SPAM set |
| did it help / resources / check-in | commercial | full set; "free" does not make it transactional |
| unsubscribe confirmation | transactional | address + best practice |
| deletion confirmation | transactional | address + best practice |

## Unsubscribe design

- One-click List-Unsubscribe header where the provider supports it.
- Suppression updated instantly on click.
- 3-day manual SLA for edge cases (direct email requests).
- Confirmation page and email.

## Failure modes

- Treating a free message as transactional to skip the footer.
- Sending a follow-up after unsubscribe because the queue was already built.
- Using IP for "state detection" without a real need.

## Pricing note

The worksheet is free and stays free. The paid products are separate (see DECK-06): packet, print/mail, institutional seats. Never charge to receive the worksheet or to unsubscribe.
`,
    actions: `# DECK-02 actions — Email Capture & Worksheet Delivery

- [ ] Build the capture form with consent line and privacy link
- [ ] Build five worksheet templates with the compliant footer and List-Unsubscribe header
- [ ] Wire suppression check before every send, including tests
- [ ] Log every send to EMAIL_LEDGER with address hash, template, timestamp, status
- [ ] Implement instant unsubscribe + 3-day manual SLA queue
- [ ] Remove IP collection unless a concrete legal requirement proves it is needed
- [ ] Run three self-tests: fresh signup, unsubscribe, resubscribe-after-suppression
`,
  },
  {
    title: "DECK-03 — Narrative Tool: Consent, Retention, Disclosure",
    notes: `# narrative tool

Most sensitive data in the system. Someone writes about their arrest. This is human vulnerability in text form.

Flow: landing -> write your story -> free text, anonymous-first, no required fields -> save or download. Download always available, never gated.

Consent moment: unchecked checkbox. If unchecked: EPHEMERAL. Session only, not persisted, download still works, FM retains nothing, page says so. If checked: store narrative + consent timestamp + consent text + deletion token. Consent record lives in the same file the user downloads. User copy = FM copy exactly.

Deletion: email a request, search, delete within 3 days, confirm, log the fact of deletion only.

Use of retained narratives: aggregate themes only; worksheet improvement; never marketing, never cross-brand, never public identification. Membrane enforces KinloaSlate never receives narrative data.

Legal: no HIPAA, no 42 CFR Part 2 at this stage. FTC Section 5 is the real rule: do exactly what the privacy notice says. UPL risk if we draft legal documents or advise; we organize the user's own words.

Ethical: they know what they give; they hold the same copy; they can leave; no sale from vulnerability; their story never becomes marketing.`,
    readme: `# DECK-03 — Narrative Tool: Consent, Retention, Disclosure

## Purpose

Specify the most sensitive surface in the system: a place where a recently arrested person can write their own story, keep an identical copy, decide whether Felons Melon retains it, and delete it without a support ticket.

## Flow

1. "Write your story" — free text, anonymous-first, no required fields.
2. User can download their copy at any time, never gated.
3. At save: consent checkbox, unchecked by default.
4. Unchecked -> **ephemeral**: session only, not persisted, download works, FM retains nothing, page says so.
5. Checked -> **retained**: narrative, consent timestamp, consent text shown, deletion token. The consent record is part of the same file the user downloads.
6. User copy and FM copy are byte-identical. No hidden metadata.

## Deletion

- User emails the contact address with narrative ID or email.
- System finds matching records, deletes within 3 days, confirms to the user.
- Only the fact of deletion is logged (timestamp, reason, narrative id). The text is destroyed.

## What retained narratives may be used for

- Aggregate themes only: "X% mention bail, Y% employment, Z% custody."
- Worksheet improvement.
- Never: marketing, cross-brand, third parties, individual identification, public testimonials.

## Legal reality

- HIPAA does not apply; we are not a covered entity.
- 42 CFR Part 2 does not apply; we are not a treatment program.
- FTC Section 5 does: the privacy notice is the obligation. Say what we do, do what we say.
- Unauthorized practice of law is the real boundary. We organize the user's own words. We do not draft legal documents, advise on strategy, or predict outcomes.

## Ethical standard

They know what they give. They hold the same copy. They can leave. We never sell their vulnerability. Their story never becomes our marketing.
`,
    structured: `# DECK-03 structured — Narrative Tool

## Consent states

| State | Persisted | FM copy | User copy | Page message |
|---|---|---|---|---|
| ephemeral | no | none | yes | "Your narrative was not retained." |
| retained | yes | identical | identical | "Saved. Your copy and our copy are identical." |
| deleted | no | destroyed | user may still hold theirs | "Your narrative has been deleted." |

## Data held when retained

- narrative text
- consent timestamp
- consent text shown
- source ("fm-narrative")
- deletion token
- no IP unless a documented need forces it

## Deletion procedure

1. Request arrives by email with narrative id or email address.
2. Match records; confirm identity with the minimum needed.
3. Destroy narrative text; log deletion event only.
4. Confirm to user within 3 days.

## Use policy

Allowed: aggregate counts for worksheet design.
Forbidden: marketing, cross-brand, third parties, public identification, testimonials, model training on individual stories without a separate explicit consent.

## Legal boundary (UPL)

- We do not tell people what to say to a judge, prosecutor, or attorney.
- We do not draft motions, pleadings, or legal strategy.
- We do not predict case outcomes.
- We offer structure for the user's own words and a download they control.
- Add a plain-language disclaimer at the editor and in the download.

## Open questions

- Encryption at rest and which store owns the key.
- Retention period for retained narratives (default: until deletion request; consider 24-month review).
- Whether an attorney-review option is offered later; if so, it is a separate product with a separate entity or a licensed partner.
`,
    actions: `# DECK-03 actions — Narrative Tool

- [ ] Build the editor with anonymous-first flow and always-available download
- [ ] Implement the unchecked-by-default consent checkbox and ephemeral path
- [ ] Store consent record inside the same file the user downloads
- [ ] Implement deletion request queue with 3-day SLA and confirmation
- [ ] Add UPL disclaimer at editor and in the download
- [ ] Encrypt narrative storage at rest; document key ownership
- [ ] Write the aggregate-analysis query so it cannot return individual rows
- [ ] Review with an attorney before launch: UPL, privacy notice, deletion
`,
  },
  {
    title: "DECK-04 — Privacy Notice & Compliance Artifacts",
    notes: `# privacy notice and compliance artifacts

Need the actual text, not a promise of one. Placeholders for physical address, contact email, effective date.

Notice covers: what we collect, why, who sees it, how long, rights, contact, effective date.

Key commitments the code must keep:
- deletion within 3 days of a verified request
- unsubscribe instant automated, 3-day manual SLA
- no third-party sharing
- no cross-brand marketing
- user copy = FM copy

Message-type matrix from the plan. CAN-SPAM checklist. UPL disclaimer. State-law thresholds not triggered at current scale but note them. FTC Section 5: do what the notice says.

This is a draft for attorney review, not legal advice.`,
    readme: `# DECK-04 — Privacy Notice & Compliance Artifacts

## Purpose

Supply the actual user-facing compliance text and the operations that must match it, so the ethical claims in the other decks are enforceable promises rather than good intentions.

## What this deck contains

1. A draft privacy notice for felonsmelon.com (placeholders for physical address, contact email, effective date).
2. The message-type matrix for every email class.
3. The deletion SLA (3 days) and the unsubscribe SLA (instant automated, 3-day manual).
4. The CAN-SPAM checklist the templates must satisfy.
5. The UPL disclaimer for the narrative and worksheet surfaces.
6. A note on state privacy law thresholds and the FTC Section 5 rule.

## Important

This is a draft prepared by the build agent for review by a licensed attorney. It is not legal advice and must not be published as final without that review.

## The one rule that outranks the rest

The privacy notice is the contract. Whatever it says, the code must do. If the notice says deletion within 3 days, the system deletes within 3 days. If it says no third-party sharing, there is no analytics vendor. Nothing more, nothing less.
`,
    structured: `# DECK-04 structured — Privacy Notice & Compliance Artifacts

## Draft privacy notice (for attorney review)

**Felons Melon privacy notice — effective [DATE]**

Felons Melon is a service of Bradford Auto Solutions LLC, [PHYSICAL ADDRESS]. Contact: [CONTACT EMAIL].

**What we collect.** Your email address when you request a worksheet; the text you write if you use the narrative tool; basic technical data needed to run the service. We do not buy lists. We do not collect data from third parties about you.

**Why we collect it.** To send the worksheet you asked for, to send occasional reentry resources, and — only if you tick the consent box — to retain your narrative to improve reentry worksheets. Aggregate themes only; never individual stories for marketing.

**Who sees it.** Felons Melon and Bradford Auto Solutions LLC. No third parties. No KinloaSlate marketing. No sale of data.

**How long.** Email: until you unsubscribe or ask for deletion. Narrative: until you ask for deletion, or [RETENTION PERIOD] for retained narratives.

**Your rights.** Unsubscribe at any time (instant automated path; 3-day manual fallback). Request deletion of your narrative at any time; deletion completed within 3 days of a verified request. Request a copy of what we hold.

**What we do not do.** We do not give legal advice. We do not draft legal documents. We do not predict case outcomes. We organize your own words; decisions about your case belong to you and your attorney.

**Effective date.** [DATE].

## Message-type matrix

| Message | Class | Compliance set |
|---|---|---|
| worksheet delivery | commercial | address + unsubscribe + honest header |
| day-2 / day-7 / day-14 / monthly | commercial | same |
| unsubscribe confirmation | transactional | address + best practice |
| deletion confirmation | transactional | address + best practice |

## SLAs

- Unsubscribe: instant automated suppression; 3-day manual fallback.
- Deletion: 3 days from verified request; confirmation sent.
- Complaint response: same day.

## CAN-SPAM checklist (per template)

- [ ] honest from-name and subject
- [ ] valid physical postal address
- [ ] clear unsubscribe link
- [ ] List-Unsubscribe header where supported
- [ ] suppression checked before send
- [ ] no harvested addresses
- [ ] opt-out honored instantly

## State law note

CCPA/CPRA, Colorado, Virginia and similar laws have thresholds not triggered at current scale. Re-check annually and before any institutional contract.

## UPL disclaimer (surface copy)

"Felons Melon helps you organize your own words. We are not a law firm and do not give legal advice. For advice about your case, talk to a licensed attorney."
`,
    actions: `# DECK-04 actions — Privacy Notice & Compliance Artifacts

- [ ] Resolve physical address, contact email, effective date
- [ ] Attorney review of the privacy notice and UPL disclaimer
- [ ] Implement deletion and unsubscribe SLAs with timestamped evidence
- [ ] Add the CAN-SPAM checklist to the template review process
- [ ] Publish the notice on felonsmelon.com and link it from every capture surface
- [ ] Re-check state privacy thresholds before any institutional pilot
- [ ] Keep a dated version history of the notice; never edit silently
`,
  },
  {
    title: "DECK-05 — Cockpit TRUTH: Email & Narrative Gates",
    notes: `# cockpit truth additions

The TRUTH pane already shows pair, canon, RAP, gates, pins, deck, jobs, watcher. Add the email and narrative gates so the operator sees the ethical promises as live facts.

Email: sends, opens, clicks, bounces, unsubscribes, complaints. Alert if complaints > 0.1% or bounce > 5% or unsub > 2%. Show suppression count and last unsubscribe.

Narrative: retained vs ephemeral vs deleted counts, deletion requests open/closed with SLA age, any request over 3 days flagged red.

Privacy: notice version and published date; if code changes a promise, red.

No PII in the pane: counts and ages only, never addresses or narrative text.

Depends on DECK-02 and DECK-03 landing first. Spec now, build after.`,
    readme: `# DECK-05 — Cockpit TRUTH: Email & Narrative Gates

## Purpose

Make the ethical promises observable. If the privacy notice says deletion within 3 days, the cockpit should show whether that is true today — for every request, not on average.

## What gets added to the TRUTH pane

### Email gates

- sends (total, last 24h), opens %, clicks %, bounces %, unsubscribes, complaints
- suppression list size and last update
- alerts: complaints > 0.1%, hard bounce > 5%, unsubscribe > 2%
- every alert names the campaign and the template

### Narrative gates

- retained / ephemeral / deleted counts
- open deletion requests with age; red if any is older than 3 days
- consent coverage: retained records with a consent record = 100% (hard invariant)
- aggregate-analysis query events (count only)

### Privacy gates

- published notice version and date
- mismatch flag: if a coded promise differs from the notice version, red
- data-store health: last successful deletion run, last failed deletion run

## Non-negotiable rule

The pane shows counts and ages, never addresses, never narrative text. It is read-only and must stay read-only.

## Dependencies

DECK-02 (email pipeline) and DECK-03 (narrative store) must land first. This deck is a spec, not an implementation.
`,
    structured: `# DECK-05 structured — Cockpit TRUTH: Email & Narrative Gates

## Email metrics

| Metric | Source | Green | Amber | Red |
|---|---|---|---|---|
| complaint rate | provider API | 0 | <0.1% | >=0.1% |
| hard bounce | provider API | <2% | 2-5% | >5% |
| unsubscribe rate | provider API | <1% | 1-2% | >2% |
| suppression size | suppression table | any | sudden drop | unexpected growth |

## Narrative metrics

| Metric | Meaning | Red condition |
|---|---|---|
| open deletion requests | requests not yet completed | any older than 3 days |
| consent coverage | retained records with consent | below 100% |
| ephemeral writes | session-only saves | any persisted record |
| deletion completions | completed | none in 24h while requests open |

## Privacy version gate

The notice has a version id. The code that enforces retention and unsubscribe carries the same id. If they differ, the pane is red and the app warns.

## Implementation notes

- Read-only aggregation, same rule as the existing truth.py.
- No PII. Hashed ids only if a drill-down is ever added.
- Poll provider API on a schedule; never on page load.
- Store daily snapshots so a spike is visible after the fact.

## Alert routing

- Cockpit banner + daily email to the operator.
- Complaints always page, never batch.
`,
    actions: `# DECK-05 actions — Cockpit TRUTH: Email & Narrative Gates

- [ ] Define provider API fields and polling schedule
- [ ] Add email metrics panel with thresholds
- [ ] Add narrative gate panel with deletion SLA age
- [ ] Add privacy version gate (notice version = code version)
- [ ] Ensure the pane remains read-only and PII-free
- [ ] Test with synthetic data for green, amber and red states
- [ ] Build only after DECK-02 and DECK-03 land
`,
  },
  {
    title: "DECK-06 — The $100 Bill: Buyer, Offer, UPL Guardrails",
    notes: `# the hundred dollar bill

The gap is real: nobody calls a person after arrest with affordable help. Attorneys send notices of impending incarceration that say it can be avoided for $5k. Families search at 2am. Public defenders are overloaded. Reentry orgs hand out photocopies.

The compliance plan from GLP is a strong spine. It is also a plan with no revenue. That is the part that steps away from the hundred dollar bill.

Who actually pays, in order of willingness:
1. family members (they search, they pay, they are scared)
2. defense attorneys and public defenders (case budget, client outcomes)
3. reentry orgs and workforce programs (grant budgets)
4. courts/pretrial services (procurement, slow)

Offer ladder, aligned to the mission rules (charge for climbing, never for not drowning):
- free: worksheet, narrative, download, deletion, unsubscribe — permanently
- paid: the Ready-to-Send Packet (organized narrative + proof checklist + print/mail option) — charge for the artifact and the postage, never for the help
- paid: Defender Seat (per-caseworker dashboard, packet export, audit log) — institution pays
- paid: Family Navigation call/print kit — optional, priced clearly, never required for the free path

Do not monetize: crisis data, fear, ads, cross-brand, access to the free path.

UPL boundary is the make-or-break: we organize the user's own words; we do not draft legal documents, advise strategy, or predict outcomes. Any "court-ready" claim must be attorney-reviewed or dropped.

Data risk is the real exposure: narrative breach is catastrophic for the user. Encrypt, minimize, delete, never cross-brand, no third-party analytics.

Validation: 3 defender conversations, 10 free kits, 20 families, 2 paid packets, 1 institutional pilot. Measure time-to-help, completion, willingness to pay, and whether anyone asks for legal advice (which we refuse).`,
    readme: `# DECK-06 — The $100 Bill: Buyer, Offer, UPL Guardrails

## Purpose

Protect the actual business in the ethical plan: the gap is real, the buyer exists, and the free help is the distribution. This deck defines who pays, for what, at what boundary — without monetizing crisis or crossing into legal advice.

## The gap, stated plainly

Nobody calls a person after arrest with affordable help. Attorneys send notices of impending incarceration with a $5k price to "avoid it." Families search at 2 a.m. Public defenders are overloaded. Reentry organizations hand out photocopies.

Felons Melon can be the first call that is free, fast, organized, and not trying to sell fear.

## The mistake the compliance-only plan makes

It builds consent, retention, and email compliance — and no revenue line. The free worksheet is the top of a funnel that never asks anyone to pay for anything. That is walking away from the hundred dollar bill.

## Buyer map

| Buyer | Why they pay | Willingness |
|---|---|---|
| Family members | scared, searching, paying for help | high |
| Defense attorneys / public defenders | case outcomes, client support, time saved | medium-high |
| Reentry orgs / workforce programs | grant-funded client services | medium |
| Courts / pretrial services | procurement, liability review | slow, later |

## Offer ladder (mission-aligned)

- **Free forever:** worksheet, narrative editor, download, deletion, unsubscribe. The free path is the same path.
- **Paid — Ready-to-Send Packet:** organized narrative, proof checklist, optional print and mail at cost plus margin. Charge for the artifact and postage, never for the help.
- **Paid — Defender Seat:** per-caseworker access, packet export, audit log, deletion controls. Institution pays; the client never does.
- **Paid — Family Navigation kit:** optional print/call support, clearly priced, never required to get the free worksheet.

## What we never monetize

Crisis data, fear, ads, a paywall on the free path, cross-brand marketing, access to deletion or unsubscribe.

## The UPL line (make or break)

We organize the user's own words. We do not draft legal documents, advise on strategy, or predict outcomes. Any claim like "court-ready" must be attorney-reviewed or removed. The disclaimer ships on the surface and in the download.

## Data risk

A narrative breach is catastrophic for the user. Encrypt at rest, minimize collection, delete on request, never cross-brand, no third-party analytics on narrative pages.

## Validation plan

3 defender conversations. 10 free kits. 20 families. 2 paid packets. 1 institutional pilot. Measure time-to-help, completion, willingness to pay, and how often someone asks for legal advice (we refuse, politely).

## Status

Hypotheses to test, not commitments. Prices and terms are proposals for a 90-day experiment.
`,
    structured: `# DECK-06 structured — The $100 Bill

## The thesis

The ethical plan is also the commercial plan if — and only if — the free help is distribution and the paid product is an artifact or an institutional seat. The compliance plan alone has no revenue; that is the gap this deck closes.

## Who pays

- **Families** pay for speed, organization, and a packet they can hand to an attorney. Do not exploit fear; price modestly and show the free path first.
- **Defenders** pay for a client-support tool that saves time and produces a clean narrative packet with an audit trail.
- **Institutions** pay per seat for reentry orgs and workforce programs.

## Price hypotheses (to test, not promises)

| Offer | Hypothesis | Notes |
|---|---|---|
| Ready-to-Send Packet | $19-29 digital; +$9-15 print/mail | print at cost plus margin |
| Defender Seat | $79-199/agent/month | per organization |
| Family Navigation kit | $39-59 optional | never required |

Free forever: worksheet, narrative, download, deletion, unsubscribe.

## Unit economics to prove

- cost per worksheet delivery (email + compute)
- support minutes per 100 users
- paid conversion from free worksheet (target 3-8%, test honestly)
- institutional pilot value (caseworker hours saved)

## Why this beats the $5k notice

The $5k notice monetizes fear and usually cannot deliver what it implies. We monetize organization and optional artifacts, with a free path that actually helps. The trust that earns is the moat.

## UPL guardrails (hard)

1. No drafting of legal documents, motions, or pleadings.
2. No advice on what to say to a judge, prosecutor, or police.
3. No outcome predictions.
4. No "court-ready" claim without attorney review.
5. Disclaimer on the editor, the packet, and the email footer.

## Risk register

| Risk | Mitigation |
|---|---|
| UPL accusation | guardrails, disclaimers, attorney review, no legal deliverables |
| data breach | encryption, minimization, deletion, no third-party analytics |
| deceptive claims | claims reviewed against delivery; "free" means free |
| platform AUP | opt-in capture, compliant footer, suppression |
| chargebacks | clear pricing, free path visible, refund policy |

## 90-day validation

1. 3 defender conversations (do they want it? what format? what price?).
2. 10 free kits to families (time-to-help, completion).
3. 20 organic captures (conversion, unsubscribe, complaints).
4. 2 paid packets (willingness to pay, support load).
5. 1 institutional pilot (caseworker time saved).

Kill or keep after 90 days based on evidence, not enthusiasm.
`,
    actions: `# DECK-06 actions — The $100 Bill

- [ ] Interview 3 defenders and 3 reentry-org caseworkers; record exact words
- [ ] Ship the free worksheet first and measure completion, not signups
- [ ] Draft the Ready-to-Send Packet spec with the UPL disclaimer
- [ ] Get attorney review of any "court-ready" or packet claim before publishing
- [ ] Build a cost model: delivery, support minutes, print/mail margin
- [ ] Run the 90-day validation and be willing to kill the paid tier if the data says no
- [ ] Never gate deletion, unsubscribe, download, or the free worksheet behind payment
`,
  },
  {
    title: "DECK-07 — 90-Day Load Test & First Real User",
    notes: `# load test and first real user

Do not launch to a crowd. Test the structure on ourselves first.

test1: full path, fresh email, worksheet arrives, unsubscribe works.
test2: different email, narrative, consent, download, compare copies identical.
test3: narrative, no consent (ephemeral), confirm nothing persisted; then retained narrative and deletion request, verify gone within 3 days.

Then one real person, watched, with no campaign. The cockpit shows the truth.

Exit criteria: worksheet < 5 min, unsubscribe instant, deletion within 3 days, no PII in cockpit, no cross-brand leak, UPL disclaimer present on every surface.

If it breaks, record where the resistance was. That is the next deck.`,
    readme: `# DECK-07 — 90-Day Load Test & First Real User

## Purpose

Specify the human test that has to pass before any campaign: three self-tests and one real person, watched, with the cockpit showing the truth.

## Test 1 — the first touch

Fresh address. Request the worksheet. Confirm delivery within 5 minutes, correct template, compliant footer, working unsubscribe. Press unsubscribe; confirm suppression is instant.

## Test 2 — the retained narrative

Write a narrative, tick consent, save, download. Compare the downloaded file to the retained file: they must be identical. Confirm consent record is inside the file.

## Test 3 — the ephemeral and deletion paths

Write a narrative without consent. Confirm nothing persisted. Then write one with consent and request deletion. Confirm deletion within 3 days and a confirmation to the user. Confirm only the deletion event remains.

## The first real user

One person, not a campaign. Someone recently arrested, or someone who finds the site. Watch the cockpit, not the person's screen. Confirm: worksheet arrives, narrative saves, unsubscribe works, deletion path is reachable.

## Exit criteria (all must be true)

- worksheet under 5 minutes
- unsubscribe instant automated, 3-day manual fallback documented
- deletion within 3 days with confirmation
- no PII in the cockpit
- no cross-brand leak (KinloaSlate sees nothing)
- UPL disclaimer on every surface
- security gate green on the build that ships

## If it breaks

Record exactly where the resistance was. That becomes the next deck, not a patch-and-hope.
`,
    structured: `# DECK-07 structured — 90-Day Load Test

## Schedule

| Window | Test | Owner | Evidence |
|---|---|---|---|
| day 1 | test1 worksheet + unsubscribe | operator | timestamps, headers, suppression log |
| day 2 | test2 retained narrative + copy parity | operator | sha256 of user copy vs FM copy |
| day 3 | test3 ephemeral + deletion | operator | persistence check, deletion log |
| day 7 | first real user | operator | cockpit screenshot, no PII |
| day 30 | review | operator | conversion, complaints, support load |
| day 90 | kill/keep paid tier | operator | unit economics |

## Exit criteria

1. Delivery under 5 minutes.
2. Unsubscribe instant; suppression verified.
3. Deletion within 3 days; confirmation delivered.
4. Cockpit carries no PII.
5. Cross-brand projection returns nothing for narrative keys.
6. UPL disclaimer present everywhere.
7. Security gate green; baseline current.

## What "watched" means

The cockpit TRUTH pane is open during the test. We check state, not the person's private screens. No recording of the user's narrative.

## Failure protocol

- Stop the test.
- Record the exact failing step and timestamp.
- Fix, re-run from step 1.
- Do not proceed to real users on a partial pass.
`,
    actions: `# DECK-07 actions — 90-Day Load Test

- [ ] Schedule the three self-tests on the same week
- [ ] Build a copy-parity check (hash user download vs retained record)
- [ ] Verify ephemeral path leaves no file on disk
- [ ] Verify deletion removes text and keeps only the event
- [ ] Prepare the first-user script with no PII recording
- [ ] Review at day 30 and day 90; kill or keep the paid tier on evidence
`,
  },
];

function findWarboardByTitle(store, title) {
  return store.listWarboards().find((item) => item.title === title) || null;
}

function main() {
  const store = new WarboardStore({ appRoot: APP_ROOT });
  store.init();
  store.setBoxTarget(BOX_TARGET);

  const results = [];
  for (const spec of DECKS) {
    let warboard = findWarboardByTitle(store, spec.title);
    if (!warboard) {
      warboard = store.createWarboard(spec.title);
      console.log(`warboard created  ${warboard.id}`);
    } else {
      console.log(`warboard exists   ${warboard.id}`);
    }
    store.saveNotes(warboard.id, spec.notes);

    const { deck } = store.convertWarboard(warboard.id);
    if (deck.locked) {
      console.log(`deck LOCKED, skip ${deck.id}`);
      results.push({ title: spec.title, id: deck.id, status: "locked-skipped" });
      continue;
    }

    store.writeDeckFile(deck.id, "00-README.md", spec.readme);
    store.writeDeckFile(deck.id, "02-structured.md", spec.structured);
    store.writeDeckFile(deck.id, "03-actions.md", spec.actions);

    const fresh = store.getDeck(deck.id);
    results.push({
      title: spec.title,
      id: deck.id,
      status: fresh.validation.ok ? "draft-ready" : "draft-INVALID",
      errors: fresh.validation.errors,
    });
    console.log(`deck draft         ${deck.id}  ${fresh.validation.ok ? "VALID" : "INVALID"}`);
  }

  const state = store.getState();
  console.log("");
  console.log("BOX TARGET:", state.box.target);
  console.log("WARBOARDS :", state.warboards.length);
  console.log("DECKS     :", state.decks.length, "(all drafts — human review gate)");
  console.log("BOX       :", `${state.box.count}/${state.box.target}`, "canShip:", state.box.canShip);
  console.log("");
  console.log("RESULTS");
  for (const result of results) {
    console.log(`  [${result.status}] ${result.title}  (${result.id})`);
    for (const error of result.errors || []) console.log(`      ! ${error}`);
  }
  const invalid = results.filter((item) => item.status === "draft-INVALID");
  if (invalid.length) {
    console.error("");
    console.error("INVALID DRAFTS:", invalid.length);
    process.exitCode = 1;
  }
}

main();
