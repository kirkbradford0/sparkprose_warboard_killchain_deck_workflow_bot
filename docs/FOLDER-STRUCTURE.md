# Folder structure — completed deck and shipped box

Everything below is real output from `node scripts/demo.js`, which lives in
`examples/`. There is no database anywhere.

## A completed deck

`data/decks/d-20261018-071500-reentry-housing-letters/`

```
d-20261018-071500-reentry-housing-letters/
├── deck.json                  metadata: id, title, status, locked, timestamps
├── .locked                    human-readable lock marker (locked-at + rule)
├── 00-README.md               summary + purpose + source + attachment list
├── 01-source-notes.md         the warboard material, verbatim
├── 02-structured.md           deterministic cleaned markdown (editable)
├── 03-actions.md              checklist of next concrete steps
└── attachments/
    ├── landlord-letter-draft.txt
    └── references/
        └── case-manager.txt
```

`deck.json`:

```json
{
  "id": "d-20261018-071500-reentry-housing-letters",
  "title": "Reentry housing letters",
  "warboard_id": "w-20261018-071452-reentry-housing-letters",
  "status": "locked",
  "locked": true,
  "created_at": "2026-10-18T13:15:00.000Z",
  "updated_at": "2026-10-18T13:16:00.000Z",
  "locked_at": "2026-10-18T13:16:00.000Z",
  "validated_at": "2026-10-18T13:16:00.000Z"
}
```

`00-README.md` (shape):

```markdown
# Reentry housing letters

## Purpose

Need a clean packet for the landlord: two references, deposit conversation,
and the sentence about the gap.

_Sharpen the sentence above so a reader who never saw the warboard knows why this deck exists._

## Source

- Warboard: `w-20261018-071452-reentry-housing-letters`
- Converted: 2026-10-18
- Raw material: 01-source-notes.md (verbatim)
- Cleaned: 02-structured.md
- Next steps: 03-actions.md

## Attachments

- `attachments/landlord-letter-draft.txt`
- `attachments/references`

## Lock rule

Once this deck is confirmed it is locked. Unlocking removes it from the current box.
```

`03-actions.md` (shape):

```markdown
# Actions — Reentry housing letters

_Checklist extracted from the warboard on 2026-10-18. Rewrite anything vague before locking._

- [ ] call the landlord
- [ ] gather two references
- [ ] check the deposit
```

## A shipped box

`data/boxes/shipped/BOX-2026-10-18-001/`

```
BOX-2026-10-18-001/
├── BOX-MANIFEST.md
├── box.json
└── decks/
    ├── d-20261018-071500-reentry-housing-letters/
    │   ├── 00-README.md … 03-actions.md
    │   ├── deck.json
    │   └── attachments/
    └── d-20261018-071540-interview-follow-up-system/
        └── … same four files
```

`BOX-MANIFEST.md` (shape):

```markdown
# BOX-MANIFEST — BOX-2026-10-18-001

- Shipped: 2026-10-18T13:17:00.000Z
- Box: box-20261018-071452-001
- Decks: 2
- Target at ship time: 2
- Sealed early: no
- Data root: …\examples\data

## Decks

### 1. Reentry housing letters

- Deck id: `d-20261018-071500-reentry-housing-letters`
- Locked: 2026-10-18T13:16:00.000Z
- Source warboard: `w-20261018-071452-reentry-housing-letters`
- Attachments: 2
- Files:
  - 00-README.md
  - 01-source-notes.md
  - 02-structured.md
  - 03-actions.md
- SHA-256:
  - 00-README.md  <64 hex chars>
  - …

## Rule

This folder is a shipped, dated copy. Editing the source decks later does not change it.
```

## The open box between ships

`data/boxes/current/box.json`

```json
{
  "id": "box-20261018-071700-002",
  "number": 2,
  "created_at": "2026-10-18T13:17:00.000Z",
  "target": 2,
  "deck_ids": [],
  "sealed": false,
  "sealed_at": null
}
```

It fills as decks are locked. When `deck_ids.length >= target` (or `sealed` is
true), **Ship Box** becomes available. Shipping copies, writes the manifest,
and replaces this file with a fresh empty box of the same target.

## Rule of thumb

If a human can read `00-README.md` and act on `03-actions.md` without opening the
app, the deck is complete. That is the standard the validator enforces.
