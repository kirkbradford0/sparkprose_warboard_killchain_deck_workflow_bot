"use strict";

/**
 * One governance DRAFT deck for the Patriarch membrane.
 *
 *   node scripts/seed-governance-warboard.js
 *
 * Creates a new warboard and converts it to a DRAFT deck. It never locks,
 * never seals, never ships, and never overwrites an existing warboard with the
 * same title. The human review gate stays intact.
 */

const path = require("node:path");

const { WarboardStore } = require("../src/core/store");

const APP_ROOT = path.resolve(__dirname, "..");
const TITLE = "GOV-01 — Patriarch Accountability Membrane";

const notes = `# patriarch accountability membrane

Doctrine: awareness creates the accountability. Trust, but check.

Three independent state axes:
- execution: QUEUED RUNNING BLOCKED FAILED DISPUTED READY_FOR_REVIEW COMPLETED CANCELLED
- evidence: UNVERIFIED VERIFIED REJECTED STALE NOT_APPLICABLE
- authorization: NOT_REQUIRED NEEDS_KIRK APPROVED DENIED

An agent writing code does not prove a build passed. A test passing does not prove deployment. HTTP 200 does not prove a database commit. An accepted email does not prove delivery.

Implemented verifier/mediation loop:
- versioned handoff contract (extends SparkProseDeck agent-handoff names)
- claims verified against authoritative sources (files, git refs, Warboard Box state, manifests, mission ledger)
- self-reported test reports are WEAK evidence, never proof
- hash-chained, privacy-redacted ledger
- bounded mediation: wording/schema allowed, evidence conflicts held, security/authorization escalated, strategy preserved open
- three-shot doctrine then NEEDS_KIRK with a precise question
- lane/data boundary blocks Felons Melon narrative from automotive before any model sees it

Open:
- Kirk decision on GitHub push + visibility (remote still shows only f5db174; local is 3 ahead)
- attorney review of the privacy notice and UPL language
- who holds the Patriarch controller role and what may auto-transform

Non-goals: no new permanent agents, no dashboard purchase, no replacing the Deck/Box engine.`;

function main() {
  const store = new WarboardStore({ appRoot: APP_ROOT });
  store.init();

  const existing = store.listWarboards().find((item) => item.title === TITLE);
  if (existing) {
    console.log(`governance warboard already exists: ${existing.id}`);
    return;
  }

  const warboard = store.createWarboard(TITLE);
  store.saveNotes(warboard.id, notes);
  const { deck } = store.convertWarboard(warboard.id);

  store.writeDeckFile(deck.id, "00-README.md", `# GOV-01 — Patriarch Accountability Membrane

## Purpose

Define and demonstrate the minimal accountability layer that makes inter-agent claims checkable: a versioned handoff contract, a verifier that reads sources of truth, bounded mediation for disagreement, and a tamper-evident redacted ledger.

## Status

**DRAFT — not reviewed, not locked, not in the box.** This deck is the governance artifact for the Patriarch work; it is not an authorization to ship anything.

## What exists

- \`patriarch/schema/handoff.v1.schema.json\` — normative contract
- \`patriarch/schema/event.v1.schema.json\` — ledger event contract
- \`patriarch/lib/\` — verifier, mediation, gate, ledger, lane boundaries
- \`patriarch/bin/patriarch.js\` — CLI: demo, submit, verify-ledger, status, mediate
- \`patriarch/tests/patriarch.test.js\` — 18 tests, deliberate failures included
- \`patriarch/docs/PATRIARCH_AWARENESS_PROTOCOL.md\` — the doctrine as implemented

## Non-goals

Not a new agent, not a daemon, not a database, not a replacement for the Deck/Box engine or the cockpit. Patriarch verifies and mediates; Kirk authorizes.

## Source

- Warboard notes: verbatim thinking and scope
- Implemented behavior: see 02-structured.md
- Next steps: 03-actions.md
`);

  store.writeDeckFile(deck.id, "02-structured.md", `# GOV-01 structured — Patriarch Accountability Membrane

## Three axes, never collapsed

| Axis | States | Rule |
|---|---|---|
| Execution | QUEUED RUNNING BLOCKED FAILED DISPUTED READY_FOR_REVIEW COMPLETED CANCELLED | only COMPLETED unlocks dependents, and only with verified evidence |
| Evidence | UNVERIFIED VERIFIED REJECTED STALE NOT_APPLICABLE | rejected contradicts the claim; stale is not truth; self-reported reports are UNVERIFIED |
| Authorization | NOT_REQUIRED NEEDS_KIRK APPROVED DENIED | HIGH/IRREVERSIBLE risk requires APPROVED; NEEDS_KIRK escalates |

## The loop

1. Receive handoff; compute content hash; reject replay.
2. Record receipt redacted.
3. Lane/data boundary: private narrative never crosses lanes.
4. Validate the v1 contract.
5. Authorization: DENIED closes; NEEDS_KIRK escalates.
6. Dependency gate: only COMPLETED + OPEN dependencies unlock.
7. Verify claims against adapters: filesystem, git refs, Warboard Box decks/boxes/manifests, mission pair, test reports.
8. Derive three axes; false completion is demoted to READY_FOR_REVIEW; unverified claims become DISPUTED.
9. Append redacted events to the hash chain; write status for the cockpit.
10. Downstream work proceeds only when the gate is OPEN.

## Mediation matrix

| Class | Action | Holds affected work? |
|---|---|---|
| WORDING | ALLOW normalize | no |
| SCHEMA_VERSION (same major) | ALLOW_TRANSFORM audited | no |
| SCHEMA_VERSION (major mismatch) | ESCALATE | yes |
| EVIDENCE_CONFLICT | HOLD, check source | yes |
| OBJECTIVE_INTERPRETATION | bounded clarify, 3 shots then NEEDS_KIRK | only unresolved |
| AUTHORIZATION_CONFLICT | ESCALATE | yes |
| SECURITY_PRIVACY | ESCALATE, no data transformation | yes |
| STRATEGIC_HYPOTHESIS | PRESERVE_OPEN | no; unrelated work continues |

## Integration

- Warboard Box: read-only deck/box/manifest verification; drafts never count as locked or shipped.
- Cockpit TRUTH: reads patriarch status; no private data.
- SparkProse Deck: contract reuses the agent-handoff field names so envelopes can be imported.
- Security: bypass requires a reason and is logged; security exceptions are not silent.

## Honest limits

The verifier is static and local. It cannot prove a command ran, only that a report exists and is internally consistent. It cannot prove a delivery. It cannot prevent a human from lying. It raises the cost of false completion and leaves a trace.
`);

  store.writeDeckFile(deck.id, "03-actions.md", `# GOV-01 actions — Patriarch Accountability Membrane

- [ ] Review the handoff contract and approve the state axes
- [ ] Decide who holds the Patriarch controller role (human or named agent)
- [ ] Decide whether schema-major mediation may ever auto-transform, or always escalates
- [ ] Run \`node patriarch/bin/patriarch.js demo\` and \`node patriarch/tests/patriarch.test.js\`
- [ ] Verify the ledger chain and confirm the redaction rules
- [ ] Wire the cockpit panel to the Patriarch status file (read-only)
- [ ] Confirm the security bypass is reason-required and logged
- [ ] Decide GitHub push and repository visibility (Kirk's gate)
- [ ] Attorney review of privacy notice and UPL language before any launch claim
- [ ] Lock this deck only after review; do not auto-ship
`);

  const fresh = store.getDeck(deck.id);
  console.log(`governance warboard : ${warboard.id}`);
  console.log(`governance deck     : ${deck.id}`);
  console.log(`deck status         : ${fresh.status} / locked=${fresh.locked}`);
  console.log(`validation          : ${fresh.validation.ok ? "VALID" : "INVALID " + fresh.validation.errors.join("; ")}`);
  console.log("not locked, not shipped — human review gate intact");
}

main();
