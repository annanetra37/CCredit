# Attribute Origination Portal — User Guide

*Every section comes twice: first the clear version, then an “Explain it like
I’m five” (ELI5) version. Read whichever suits you — they say the same thing.*

---

## 1. What is this portal?

**Clear:** The portal collects your solar generation data, checks it from
three independent sources, converts it into certified environmental
attributes (I-RECs and carbon credits), sells them, and pays site owners —
while keeping a tamper-evident audit trail an external auditor can verify
years later.

**ELI5:** Your solar panels make two things: electricity, and *bragging
rights* that the electricity was clean. Companies pay real money for those
bragging rights. This portal is the machine that collects the proof, gets the
bragging rights officially certified, sells them, and sends you your share —
and it keeps receipts for everything, forever, so nobody can ever accuse
anyone of cheating.

---

## 2. Signing in

**Clear:** Go to the portal, enter your email and password. The interface is
in Armenian by default; switch with the Հայերեն / English buttons on the
login page. Your role decides what you see: operators land on the console,
owners on “My solar”, installers on “Fleet”, auditors on the auditor console.

**ELI5:** One door, but it opens onto different rooms depending on who you
are. A bakery owner sees their earnings; an auditor sees the evidence room;
the operations team sees the whole engine room. You can't wander into a room
that isn't yours — the doors are actually locked (HTTP 403), not just hidden.

💡 **The little “i” icons.** Every strange word (additionality, vintage,
redemption…) has a small ⓘ next to it. Hover for one line, click for a plain
language explanation with an example — in your language. The full dictionary
lives at **/glossary**. If you're ever confused, click the ⓘ. That's what
it's for.

---

## 3. The coloured strip at the top

**Clear:** The strip shows which environment you're in: LOCAL (grey),
SANDBOX (yellow), PRODUCTION (green). Sandbox sites additionally show a
yellow 🧪 banner on every screen.

**ELI5:** Yellow means practice mode — like a flight simulator wired into a
real cockpit. All the buttons work, the instruments respond, but the plane
*cannot* take off: sandbox data is physically blocked from ever reaching the
real certificate registry, by code at the deepest layer, not by a checkbox.
Practice fearlessly when you see yellow.

---

## 4. For field technicians: creating a site

**Clear:** Sites → **+ New site**. A four-step wizard: identity (site name,
owner, tax ID) → technical (capacity, inverter, modules, tilt) → location
(GPS capture with manual override) → review. The draft auto-saves locally, so
losing signal mid-wizard loses nothing. Duplicates are flagged on matching
owner tax ID. New sites usually start as sandbox until go-live.

**ELI5:** It's like filling a passport application for the solar plant, on
your phone, while standing next to it. The app remembers everything you typed
even if the connection drops in the mountains. Press the GPS button and the
phone writes down exactly where the plant lives.

After creation, the site moves through a fixed lifecycle:
LEAD → QUALIFYING → CONTRACTED → METERED → COMMISSIONED → ASSESSED →
PRODUCING. Each move is recorded with who did it and when, and illegal jumps
are refused with an explanation.

---

## 5. For operators: entering generation data by hand

**Clear:** Readings → **Manual entry**. Choose site and month, then type
three numbers: meter export (the record of account), inverter total, and the
utility bill figure — plus optional auxiliary consumption. Each figure is
stored as an append-only reading tagged MANUAL with your name on it. Bulk
import (CSV, 12 months at once) validates every row first; either all rows
commit or none do.

**ELI5:** Three different witnesses saw how much electricity your plant made:
the official meter, the inverter's own diary, and the electric company's
bill. You write down what each witness says. The system marks
everything you typed with a loud yellow **✎ MANUAL** badge — a typed number
is never allowed to disguise itself as a measured one — and it never forgets
who held the pen.

---

## 5B. ENA billing data: the official numbers (Revision R1)

**Clear:** The portal's official generation record comes from ENA (the
electricity network) billing data, with the owner's recorded consent — ENA
already operates a certified, sealed meter at every grid connection. Bills
arrive by feed, file drop, per-site request or owner upload; the parser
extracts account, period, export and import; and a human analyst confirms
every figure before it becomes a reading (low-confidence extractions sort to
the top of the queue). ENA data lags 30–45 days, so periods show
AWAITING_SOURCE and owners see clearly-marked provisional inverter figures
until the official number lands. The coverage dashboard shows every site and
period as received, awaited or overdue.

**ELI5:** Instead of us installing a second electricity meter on your roof,
we simply ask the electric company — with your written permission — for the
official number they already measure (they have to: they pay you for it).
Their letter takes about a month to arrive, so meanwhile the portal shows
your inverter's estimate with a big "not official yet" sticker. When the
official letter comes, a human reads it, checks the numbers, and only then do
they count. Nothing a computer guessed ever becomes a certificate by itself.

**Why the app number and the official number never match:** your inverter
counts everything the panels made; ENA counts only what left your building
into the grid. The difference is what you used yourself — good for your
electricity bill, but not what certificates are issued on. The portal knows
this and compares the two numbers intelligently instead of raising a false
alarm.

## 6. Reconciliation: making the numbers agree

**Clear:** Reconciliation compares the three sources pairwise. Within
tolerance (default 2%): the period becomes RECONCILED and the meter value is
adopted. Outside tolerance: DISPUTED, and the period joins the exception
queue with values, deltas, and calibration status attached. Resolutions
require a reason from a controlled list plus a note; both go to the audit
log. Missing sources are handled: two sources may reconcile (flagged), one
source needs recorded supervisor approval.

**ELI5:** Imagine the three witnesses giving their stories. If they agree
(small differences are normal — wires eat a little electricity), the case is
closed and the official meter's story is written into the book. If someone's
story is way off, the case goes to a human detective, who must write down
what happened ("the inverter's clock was broken") before the book can be
updated. No certificate is ever printed from a story that didn't check out.

---

## 7. The attribute ledger: where double-selling becomes impossible

**Clear:** Each reconciled month becomes exactly one attribute row per site —
`UNIQUE (site_id, period_id)` in the database guarantees a second one cannot
exist. Attributes move MEASURED → RECONCILED → ELIGIBLE → ALLOCATED → ISSUED
→ TRANSFERRED → REDEEMED. Moving to ALLOCATED requires four guards: period
reconciled, contract valid across the period, meter calibration covering the
whole period, and a track assigned. REDEEMED is terminal.

**ELI5:** Think of each month of sunshine as a golden coin that can only be
minted once. The vault door physically cannot mint a second coin for the same
month — it's not a rule someone follows, it's how the vault is built. And
before any coin leaves the vault, four locks must open: the numbers checked
out, the paperwork was signed, the meter was certified, and someone decided
what kind of coin it is.

**Track assignment** (the "what kind of coin" decision): each site is
assessed once for whether it can produce carbon credits (needs
*additionality* — click the ⓘ) or I-RECs only. The decision needs a named
assessor and a written rationale, because it is effectively irreversible.

---

## 8. Issuance: turning attributes into certificates

**Clear:** Issuance → register the site with the I-REC Issuer (documents pull
from the vault), then build an issue request from ALLOCATED attributes on the
IREC track. Volume comes from the ledger and is not editable. A pre-submission
checklist shows every guard that passed. Sandbox attributes are rejected at
the service boundary regardless of what the screen shows. Issued serials bind
permanently to their attribute rows.

**ELI5:** This is where the coins go to the official mint and come back with
serial numbers engraved on them. You can't tell the mint how many coins you
have — the vault counts them itself. And if a practice coin somehow sneaks
into the bag, the door to the mint slams shut automatically.

---

## 9. For site owners: “My solar”

**Clear:** Your portal shows monthly generation, certificate status, payout
statements (MWh, rate, gross, deductions, net — in dram), and what you may
and may not claim after selling your attributes, including your retained
share.

**ELI5:** Your page answers three questions: *How much did my roof make?
When do I get paid? What am I allowed to say about it?* That last one
matters: once you sell the bragging rights for March, the buyer owns them —
saying “my bakery ran on solar in March” would be selling the same thing
twice, which is the one unforgivable sin in this business. The part you kept
(your retained share) stays yours to brag about, and the portal gives you a
paper that proves it.

---

## 10. For installers: “Fleet”

**Clear:** Vendors see their whole installed base (including
non-contracted sites), site statuses, and commission statements accrued from
certificate sales of referred sites.

**ELI5:** One screen showing every roof you've ever installed, whether it's
healthy, and how much pocket money each one is sending you for having made
the introduction.

---

## 11. For auditors: the console

**Clear:** Auditor accounts are read-only, time-limited, and every view is
itself logged. The console offers point-in-time reconstruction (pick any past
date; contracts, factors and readings render as they stood), self-service
hash-chain verification, and traceable calculations — every tonne figure
lists the raw reading IDs and factor version behind it.

**ELI5:** The auditor gets a time machine and a lie detector. The time
machine shows the office exactly as it was on any past day — not a
reconstruction from memory, the actual filing cabinet. The lie detector
(the hash chain) checks that nobody quietly rewrote an old page: every page
is glued to the previous one with mathematics, so tearing one out or editing
it leaves visible scars. The auditor can press the "check the glue" button
themselves, any time, without asking us — which is exactly why audits get
cheaper every year.

---

## 12. The safety rails, in one place

| The rail | What it stops |
|---|---|
| Append-only readings | History being edited (the database role literally cannot UPDATE) |
| Hash chain + nightly check | History being edited *by anyone*, even a superuser — it becomes visible within a day |
| One attribute per period | The same energy being certified twice |
| Four allocation guards | Certificates from unreconciled data, lapsed contracts or uncalibrated meters |
| Sandbox gate | A typed-in practice number ever becoming a real certificate |
| MANUAL badge | A typed number pretending to be a measured one |
| Audit log on everything | "Who changed this?" ever being unanswerable |

**ELI5, one sentence:** the portal is built so that being honest is the only
thing it is physically capable of.

---

## 13. Everyday how-do-I…

- **…look up a word?** Click any ⓘ, or open /glossary.
- **…enter last month's numbers?** Readings → Manual entry → pick site &
  month → type the three figures → Save → Run reconciliation.
- **…see why a month is stuck?** Reconciliation queue — the dispute card
  shows all three values and what to do next.
- **…sell certificates?** They must be ALLOCATED first (Attributes page);
  then Issuance → build the request.
- **…add a new word to the dictionary?** Admin → Glossary. Both languages,
  always — the form nags you about the missing half.
- **…kick a user out right now?** Admin → Sessions → Revoke. Their very next
  click is refused.
- **…prove nothing was tampered with?** Audit page (or auditor console) →
  Run verification now.
