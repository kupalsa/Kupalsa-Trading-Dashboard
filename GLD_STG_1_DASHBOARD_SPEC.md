# GLD_STG_1 Trading Dashboard — Implementation Spec

This document is a self-contained brief for building a trading dashboard
website around Nik's gold-futures backtest/journal system (GLD_STG_1). It
was distilled from a long strategy-design conversation with Claude (chat) —
Claude Code should treat this as the source of truth, not the chat itself.

## 1. What this system is

Nik trades gold futures (MGC) manually, using a discretionary Wyckoff/ICT
strategy he is converting into an explicit rulebook. The dashboard's job is
to be the trade journal + backtest log + analytics layer for that strategy —
NOT to auto-trade or generate signals. Every trade is entered by Nik from a
TradingView screenshot; the dashboard's value is structured logging and
analysis (expectancy by setup type, A+ vs B+ tier discovery, etc.).

Existing (parallel, not to be replaced) systems:
- An Excel workbook (`GLD_STG_1_Trade_Log.xlsx`) with the same schema below —
  useful as a reference for exact field names/validation lists.
- A Notion database "GLD_STG_1: Opportunity Log (Backtest)" — same schema,
  minor naming drift noted below.
The dashboard should eventually become the primary tool; the others are
existing scaffolding built before the dashboard existed.

## 2. The Sixteen Rules (strategy logic — display these, don't hardcode as app logic)

1. Entry window Mon–Fri 16:00–19:00 Israel time. Positions are held until
   the futures market close, flattened ~5 min after ~23:00 IL (~23:05) —
   a trade can run hours past the entry window.
2. Zones: nearest unfilled 4H wick or long body above and below current
   price, refined on the 1H. No distance filter — always the nearest.
3. A zone is invalidated only when a BOS/CHoCH closes beyond it. Partial
   fill of a zone is irrelevant to its validity.
4. Trade direction must match the Wyckoff read: inside the process = trade
   zone to zone; broken (BOS through ice/creek) = trade with the break.
5. Never trade against a structural line a 15m candle has closed through.
6. Entry must produce ≥3R (≈2.88R tolerated) with a structurally valid
   stop, or no trade.
7. Stop sits under/over the 15m candle that defines the zone. Never
   widened or weakened to manufacture R.
8. Take-profit is always the nearest opposite zone, at an FVG/IFVG inside
   it. Never trades through to a further zone.
9. Final entry/stop/TP are optimized on the 1m chart on every setup type.
10. Arrival character into the zone decides confirmation need: an
    impulsive single strong 15m candle → wait for a 5m CHoCH before
    entering. A slow drift / overlapping candles → direct entry, no
    confirmation needed.
11. Trading decisions are made only on 15m candle closes. The 5m CHoCH
    check (rule 10) is the sole exception.
12. Limit orders only. Never market orders.
13. Fixed risk size on every trade until backtest data justifies sizing
    up specific setup types.
14. No 3R, no trade. Only exceeds 3R when the un-optimized (natural)
    entry/stop already clears it — 3R+ is never itself the goal of
    optimization, optimization is meant to REACH 3R, not exceed it
    artificially.
15. May stand down and wait until 17:00 to let the 13:00–17:00 4H candle
    close, since it can reshape the zones.
16. Synergy with the Wyckoff/AMD read (HTF phase agrees with LTF phase
    and direction) is MANDATORY. A non-synergy trade is a rule
    violation — it must be excluded from the backtest entirely, not
    logged as a normal data point.

## 3. Core concepts the UI needs to represent correctly

**Opportunity vs Trade.** A row in the log represents an *opportunity that
met all 16 rules*, not necessarily an executed trade. This includes limit
orders that never filled. This is deliberate and important — expectancy
must be computed per-opportunity, not per-filled-trade, or the dataset
silently excludes the effect of overly tight entries. Any "win rate" or
"expectancy" calculation in the dashboard MUST have a toggle: "all
opportunities" vs "filled only" — these will diverge and both matter.

**Natural vs Optimized.** Every opportunity has two parallel price sets:
- **Natural**: the entry/stop/TP Nik would use from pure structure, before
  any optimization. Drawn on his chart as purple lines.
- **Optimized**: the actual entry/stop/TP after 1m optimization (rule 9),
  usually tightening the entry and/or extending the TP to reach 3R (rule
  6). Drawn via TradingView's position tool (gray box = stop side always,
  colored box = profit side, color encodes setup type — see §5).

Both sets get their own Filled (Y/N), Outcome (Win/Loss/Breakeven/NA), R,
MFE (in R), and MAE (in R). This lets the dashboard directly answer: "is
Nik's optimization habit helping or hurting?" — compare Natural R×WinRate
vs Optimized R×WinRate across the dataset. Two real examples already
diverged in opposite directions (see §7), which is exactly why both must
be tracked, not just the executed one.

**Entry Zone vs Target Zone.** Not "upper zone / lower zone" — each
opportunity has an Entry Zone (the extreme traded FROM) and a Target Zone
(the opposite zone aimed AT). Both share these attributes:
- Side: Upper / Lower
- Type: Wick / Body (an unfilled 4H wick vs an unfilled long 4H body —
  these may behave differently, worth being able to filter/compare)
- **Tagged Pre-Session**: did price reach/enter the zone before 16:00
- **Tagged During Session**: did price reach/enter the zone during the
  session

Terminology note: "Tagged" means price physically reached the zone. This
is NOT the same as "Filled" (which is reserved for whether an order was
executed — see Nat Filled / Opt Filled below). Price can reach the zone
without touching an order's exact limit price.

The Target Zone has one additional attribute:
- **Broken By End**: did price CLOSE through the target zone by 23:05

This "Broken By End" attribute is deliberately kept only on the Target
Zone, not the Entry Zone. The reason: it's the direct signal for
"would extending my take-profit past this zone have paid off?" — which
is a target-side question, not an entry-side one. Cross-tabbing it
against phase/arrival/setup type is expected to reveal the conditions
under which TP extension is justified vs premature.

Plus two booleans: 2nd Upper Zone exists (Y/N), 2nd Lower Zone exists
(Y/N) — only the nearest zone on each side can ever be pre-tagged, so
deeper zones are just tracked for existence.

**Wyckoff Phase — two levels.** Phase HTF (4H/daily, slow structure) and
Phase LTF (15m, fast structure), each one of A/B/C/D/E. Synergy (rule 16)
means the LTF phase's implied direction agrees with the HTF phase's. Do
NOT collapse these into one field — the whole point is to let analytics
discover whether HTF/LTF agreement correlates with better outcomes.

**FVG — two fields, not one.** The Fair Value Gap is an imbalance drawn
on the 1m chart (pink lines). Two separate questions get logged:
- **FVG Present at Entry**: was there an FVG at the entry point at all
- **FVG Filled**: if one was present, was it filled (Yes/No/NA)

Keeping these separate matters — "FVG Filled = No" now unambiguously
means "an FVG existed and did NOT fill" (which is a real signal about
setup quality), rather than being confused with "no FVG existed" (which
should read as FVG Present = No, FVG Filled = NA). The old single-field
version conflated the two.

**Stood Down Type.** Every session (or opportunity slot) that did NOT
result in a trade should still get a row/entry with a reason:
- "Phase E - ran away" (price already moved, no valid retest possible)
- "No quality stop" (no structurally sound stop placement available)
- "No confirmation at zone" (rule 10 confirmation never came)
- "Gap zone - untradeable" (price sits in an unfamiliar gap; Nik doesn't
  trade these — no rules exist yet for gap behavior)
- "None" (not a stand-down; a trade WAS attempted, whether or
  not it filled)
This is the denominator for base-rate analysis — without it, "how often
does setup X win" only counts trades taken, not opportunities available,
which biases every conclusion. Treat this as important as the trade log
itself, not an afterthought.

**MFE / MAE — always in R, always positive, always Direction-aware.**
MFE is the maximum favorable excursion (best price the trade reached in
your favor). MAE is the maximum adverse excursion (worst price against
you). Both are reported as positive R values.

- Window: from entry time to the 23:05 flat, regardless of when the
  trade actually closed. This deliberately includes post-close
  excursion as diagnostic data (e.g., would extending TP have paid?).
- Computation: derived from two chart-read prices (Session Peak,
  Session Trough) plus the entry and stop of each side (natural /
  optimized). For a long, Session Peak drives MFE and Session Trough
  drives MAE; for a short, the mapping reverses. Always use MAX(0, ...)
  to keep values non-negative.
- Unfilled trades: still computed as counterfactuals. Answers "what
  would this trade have looked like." Do NOT blank them out.

Why bother measuring MFE/MAE beyond outcome? Because Win/Loss/R alone
can't distinguish a clean setup (ran to target with little heat) from a
lucky one (nearly stopped out before recovering). MAE distribution
reveals stop margin: consistently small MAE means the stop is well
beyond price's typical retracement, so wider stops might not lose much
and could reduce whipsaws — or, more commonly, entries could be
tightened toward the stop for higher R. But the naive "tighten by
average MAE" is a trap; use percentiles (e.g. 20th percentile of MAE),
and segment by Setup Type before drawing conclusions, because
Continuation and Reversal setups have opposite MAE profiles.

**Swing tracking.** Nik has observed anecdotally that many trades
succeed if held overnight. The swing section makes this testable rather
than anecdotal, but is deliberately kept minimal: outcome and R only,
no MFE/MAE for the swing window.

- Window: from entry to NEXT day's 23:05 (Nik's broker forces flat at
  ~23:05 daily; a swing is one extra day).
- Entry: same physical price as intraday (limit orders don't move
  once placed). What differs is the TP, sometimes the stop, and the
  time window.
- Swing Stop: sometimes equal to the intraday stop (the same 15m
  candle can serve both windows if it's a very strong candle), often
  different. The dashboard should support both cases without treating
  same-stop as an anomaly.
- **Manual-close rule**: if neither the Swing TP nor Swing Stop is
  reached by the next day's 23:05 flat, Nik closes at market and moves
  the Swing TP line to the actual close price on his chart. In the
  log, Swing TP always reflects the *effective exit* — either the
  planned TP if hit, or the manual close price. The outcome
  (Win/Loss/Breakeven) is reported relative to the entry.
- Swing Valid: computed field that flags whether the swing would have
  been a valid entry per Nik's rules (either Swing Nat R ≥ 3 or Swing
  Opt R ≥ 3, matching his "try natural first, fall back to optimized
  if it doesn't clear 3R" logic).
- Analysis question: does the swing R distribution differ meaningfully
  from the intraday R distribution, controlling for setup type? If
  yes, a swing variant of the strategy may exist and is worth building
  toward a swing portfolio (Nik's medium-term goal).

## 4. Full field schema (56 fields)

Group them visually in the UI exactly like this — it mirrors how Nik
thinks about a trade and how he'll enter data.

### Identification
| Field | Type | Notes |
|---|---|---|
| ID | auto | sequential |
| Date | date | the ACTUAL trade/replay date, never auto-today |
| Day | auto | derived from Date (Mon–Fri) |

### Entry Zone (traded FROM)
| Field | Type | Notes |
|---|---|---|
| EZ Side | enum: Upper, Lower | |
| EZ Type | enum: Wick, Body | |
| EZ Tagged Pre-Session | bool | price reached the zone before 16:00 |
| EZ Tagged During Session | bool | price reached the zone during the session |

### Target Zone (aimed AT)
| Field | Type | Notes |
|---|---|---|
| TZ Side | enum: Upper, Lower | |
| TZ Type | enum: Wick, Body | |
| TZ Tagged Pre-Session | bool | |
| TZ Tagged During Session | bool | |
| TZ Broken By End | bool | did price close through it by 23:05 — kept only on target because this is the "should I extend TP" signal, not an entry-side question |

### Context & timing
| Field | Type | Notes |
|---|---|---|
| 2nd Upper Zone | bool | did a second zone exist beyond the first, upper side |
| 2nd Lower Zone | bool | same, lower side |
| Entry Time | time | Israel time |
| Exit Time | time | Israel time |
| Window Traded | auto enum | "16:00-17:00" / "17:00-19:00", derived from Entry Time |
| 17:00 Close Changed Zones | enum: Yes, No, NA | did the 4H candle's 17:00 close reshape a zone |
| Mins In Trade | auto number | Exit Time − Entry Time |

### Setup
| Field | Type | Notes |
|---|---|---|
| Setup Type | enum | 🟢 Reversal direct, 🟠 Reversal + Conf, 🔵 Continuation, 🟡 Break Retest, 🔴 Phase A — use these emoji-prefixed labels exactly (they mirror the chart colour convention and the Setup Types definitions in §5.1); the emoji is decorative but load-bearing for at-a-glance filtering. |
| Direction | enum: Long, Short | derived from stop-box position but stored |
| Arrival | enum: Impulsive, Mixed, Drift | eyeballed, no indicator — see rule 10 |
| FVG Present at Entry | bool | was there an FVG at the entry point at all |
| FVG Filled | enum: Yes, No, NA | if an FVG was present, was it filled during the trade (NA when no FVG was present) |
| Phase HTF | enum: A,B,C,D,E | |
| Phase LTF | enum: A,B,C,D,E | |
| Stood Down Type | enum | see §3; "None" = not a standdown (a trade was attempted) |

### Price levels (locked once entered — see §6)
| Field | Type | Notes |
|---|---|---|
| Nat Entry, Nat Stop, Nat TP | number | |
| Opt Entry, Opt Stop, Opt TP | number | |
| Nat Stop Size | auto number | \|Nat Entry − Nat Stop\| in points |
| Opt Stop Size | auto number | \|Opt Entry − Opt Stop\| in points |
| Optimization Needed | auto bool | Yes if Nat Entry ≠ Opt Entry |

### Session extremes (locked)
Two prices, read off two horizontal white lines drawn on the chart.
Together they anchor all four intraday MFE/MAE values.

| Field | Type | Notes |
|---|---|---|
| Session Peak | number | highest price from entry to 23:05 |
| Session Trough | number | lowest price from entry to 23:05 |

### Natural intraday (counterfactual outcome)
| Field | Type | Notes |
|---|---|---|
| Nat Filled | bool | would/did the natural entry get touched |
| Nat Outcome | enum: Win, Loss, Breakeven, NA | self-reported by Nik, NOT inferred from a chart image |
| Natural R | auto number | \|Nat TP − Nat Entry\| / \|Nat Entry − Nat Stop\| |
| Nat MFE R | auto number | Direction-aware, always ≥0. For a long: (Session Peak − Nat Entry) / Nat Stop Size |
| Nat MAE R | auto number | Direction-aware, always ≥0. For a long: (Nat Entry − Session Trough) / Nat Stop Size |

### Optimized intraday (actual outcome)
| Field | Type | Notes |
|---|---|---|
| Opt Filled | bool | |
| Opt Outcome | enum: Win, Loss, Breakeven, NA | self-reported |
| Optimized R | auto number | same formula, optimized levels |
| Opt MFE R | auto number | (Session Peak/Trough − Opt Entry) / Opt Stop Size, Direction-aware |
| Opt MAE R | auto number | mirror of MFE |

### Swing levels (locked)
Testing whether the same setup would have worked as a swing hold. The
window extends from entry to the NEXT day's 23:05. Deliberately kept
minimal: outcome + R only, no MFE/MAE.

| Field | Type | Notes |
|---|---|---|
| Swing TP | number | cyan line beyond the intraday TP. **Manual-close rule**: if neither Swing TP nor Swing Stop hits by next-day 23:05, Nik closes at market and MOVES Swing TP to the actual close price. So Swing TP always represents the effective exit for winning/manual-close cases. |
| Swing Stop | number | may equal intraday stop when swing keeps the same stop; drawn as a separate cyan line only when different |
| Swing Stop Size | auto number | \|Nat Entry − Swing Stop\| |
| Swing Valid | auto enum: Valid, Not Valid | Yes if either Swing Nat R ≥ 3 or Swing Opt R ≥ 3 — matches Nik's swing entry rule (try natural first, fall back to optimized if natural doesn't clear 3R) |

### Swing natural (counterfactual outcome)
| Field | Type | Notes |
|---|---|---|
| Swing Nat Outcome | enum: Win, Loss, Breakeven, NA | self-reported after next-day tracking. Win = Swing TP hit first, Loss = Swing Stop hit first, Breakeven = closed manually at entry, NA = not applicable |
| Swing Nat R | auto number | \|Swing TP − Nat Entry\| / \|Nat Entry − Swing Stop\| |

### Swing optimized (actual outcome)
| Field | Type | Notes |
|---|---|---|
| Swing Opt Outcome | enum: Win, Loss, Breakeven, NA | |
| Swing Opt R | auto number | uses Opt Entry and Swing Stop |

## 5. Setup Type color convention (for chart-review / screenshot-linked UI)

If the dashboard displays or links to TradingView screenshots, preserve
this convention (it's how Nik annotates his own charts, so the UI should
speak the same visual language):

- **Stop-side box: always gray**, regardless of setup type — identifies
  direction (gray above entry = short, gray below = long) and the stop
  boundary. Never changes.
- Profit-side box color encodes Setup Type — see §5.1 below for the full
  meaning of each color, not just the label.
- Purple lines (not boxes) mark the Natural entry and Natural TP. Purple
  is reserved for this — never reused as a setup-type color. The stop is
  NOT separately marked purple since Natural Stop == Optimized Stop
  always (the stop is never moved during optimization, per rule 7).

### 5.1 Setup Types — definitions

Five setup types fall into two families. The dashboard should surface
these definitions somewhere accessible (tooltip on the Setup Type field,
a help modal, or an inline card when Setup Type is selected). Do not
assume the label alone is self-explanatory.

**Reversal family (green, orange, red)** — fade an extreme, betting the
zone holds. Failure mode: the zone breaks.

**🟢 GREEN — Reversal, direct entry**
- Arrival: Drift — sideways, overlapping candles into the zone, no
  violent impulse.
- Entry: limit order in or just before the FVG inside the entry zone.
- Confirmation: none required. The drift arrival IS the signal.
- Rationale: a slow, orderly approach into a zone is a liquidity grab,
  not a breakout attempt. High confidence in the zone holding, so no 5m
  signal is needed.

**🟠 ORANGE — Reversal + confirmation**
- Arrival: Impulsive — a single strong 15m candle drives into the zone.
- Entry: after price enters the FVG in the zone AND a 5m CHoCH forms
  confirming the reversal.
- Confirmation: required — 5m CHoCH after the FVG fill.
- Rationale: an impulsive arrival raises breakout risk. The 5m CHoCH is
  what tells you the reversal has actually started, rather than the zone
  being about to fail.

**🔴 RED — Phase A**
- Context: at a buy climax (BC) or selling climax (SC) — the end of a
  strong impulsive move. You're fading the extreme.
- Entry: on a retracement back toward the BC/SC, usually with an FVG.
- Stop: standard rule (under/over the 15m candle). In practice the 15m
  level may sit noticeably beyond the BC/SC when prior structure
  provides a natural stop level, or directly at the BC/SC when it
  doesn't. Same rule, different execution based on the chart — do NOT
  document as a phase-A-specific stop rule.
- TP: the automatic rally (AR) area, or the secondary test (ST) level.
- Rationale: fading the terminus of a strong move. Higher risk than
  green because the momentum going into the reversal is stronger — the
  ST may push through the entry area before the reversal takes hold.

**Continuation family (blue, yellow)** — join a directional move,
betting the pullback holds. Failure mode: the pullback becomes the new
move.

**🔵 BLUE — Continuation**
- Context: price already moving in the intended direction (typically
  phase E of an existing structure), and you want to join the move.
- Entry: on a retracement, sized to the move's strength — strong
  impulsive move → tight retracement, entry near the top of the last
  leg; normal move → deeper retracement to the zone/level the move
  originated from. The retracement usually contains an FVG that anchors
  entry; when no FVG is present, pick a level where retracement is
  likely based on order flow.
- Confirmation: none required — the entire move is the confirmation.
- Rationale: joining a committed directional move on the pullback.

**🟡 YELLOW — Break retest**
- Context: a zone (ice or creek) has been broken by a BOS/CHoCH close,
  and price is returning to retest the broken level.
- Entry: on the retest, in the direction of the break — mechanically
  like blue.
- Confirmation: the break itself is the primary signal; the retest is
  the entry trigger.
- Difference from blue: blue = ongoing move you're joining; yellow = a
  FRESH break just retesting the level it broke through. Same family,
  but yellow captures the specific and typically higher-conviction
  'first retest after break' entry.
- Rationale: the first retest after a fresh break is one of the
  highest-probability continuation entries in the strategy.

### 5.2 Family-level analysis

The Reversal vs Continuation split is a first-class analytical
dimension, not just a UI grouping. The dashboard should be able to
segment expectancy, win rate, R distribution, MFE/MAE, and
optimization-cost by family, not only by individual setup type. The two
families have different failure modes, so their aggregates carry
different diagnostic value.

## 6. Data integrity requirements

- **Locking price levels.** Once a row's six price fields are entered and
  confirmed, they should become read-only/locked in the UI (mirrors the
  Excel version's protected-sheet behavior). Formulas/derived fields
  (Natural R, Optimized R, Optimization Needed, Mins In Trade, Day,
  Window Traded) must never be manually editable.
- **Outcome is self-reported, not inferred.** Do not attempt to compute
  Win/Loss/Breakeven from price levels automatically — Nik explicitly
  wants to state the outcome himself (sequencing ambiguity from a static
  chart image made auto-derivation unreliable). Natural R and Optimized R
  ARE safe to auto-compute from the price triangle (pure geometry); only
  the categorical Win/Loss/Breakeven judgment is manual.
- **"None" must not be confused with a real stand-down.** Any
  aggregate stats about why opportunities were skipped should EXCLUDE
  rows where Stood Down Type = "None" (that row represents an
  executed/attempted trade, not a pass).
- **Screenshots**: each opportunity should support attaching multiple
  images (15m pre-entry, 1m entry-area detail, 15m post-close, optionally
  4H/daily context). These are reference material for manual review, not
  inputs to any automated extraction pipeline.

## 7. Example rows (for seeding / testing the schema)

**Trade 1 — Feb 2, 2026 — the pattern that motivated per-opportunity logging**
Short from an unfilled 4H wick (upper), Reversal+Confirmation, impulsive
arrival, no FVG in zone so confirmation was required (and had already
formed before the limit was placed). Natural: entry 4753.5, stop 4839.6,
TP 4633.1 → 1.40R, WOULD have filled and hit TP (+1.40R). Optimized:
entry tightened to 4786.2 purely to reach 3.03R, at knowingly low fill
odds — never filled → 0R. **The 3R optimization cost the entire trade.**

**Trade 2 — Feb 3, 2026 — the mirror case**
Long from an unfilled 4H body (lower) to an unfilled 4H wick (upper),
Reversal + Confirmation, impulsive arrival, HTF phase B / LTF phase E
(in synergy). Natural: entry 4976.8, stop 4901.9, TP 5067.9 → 1.22R,
filled, won. Optimized: entry tightened to 4960.2, TP extended to
5139.1 → 3.07R, ALSO filled, ALSO won. Session Peak reached 5182.2,
Session Trough 4930.5 → intraday Nat MFE 2.74R, Opt MFE 3.81R (both
went past their own TP). Swing TP at 5246.8 — swing R would have been
3.60 (natural) / 4.92 (optimized), Swing Valid = Yes. **Here the same
optimization behavior added 1.85R** instead of costing the trade —
opposite outcome from Trade 1 under similar-looking optimization
decisions. This is exactly the kind of divergence per-opportunity,
Natural-vs-Optimized logging is meant to surface at scale.

## 8. Suggested first-pass analytics (once ~30+ rows exist per category)

- Expectancy (avg R × win rate) split by Setup Type, computed BOTH on
  Natural and Optimized levels, BOTH on filled-only and all-opportunities.
- Whether "Optimization Needed = Yes" correlates with worse outcomes
  (adverse selection: tightening the entry can systematically filter out
  the strongest setups, since a setup that reverses hard and immediately
  is exactly the one that never comes back to a tight limit).
- Win rate / R by Arrival (Impulsive vs Mixed vs Drift).
- Win rate / R by HTF+LTF phase combination (synergy quality as a
  continuous-ish signal rather than binary).
- Zone Type (Wick vs Body) as entry zone vs target zone — do they behave
  differently.
- Stood-down rate and "was a valid setup missed" rate, especially
  segmented by whether the prior day/session was a loss (tests whether
  standing down is genuine discipline or fear).
- **TP-extension analysis**: when TZ Broken By End = Yes, calculate the
  extra R that would have been earned by extending TP past the target
  zone. Segment by Phase HTF, Phase LTF, HTF+LTF combo, Arrival, and
  Setup Type to identify the specific conditions under which TP
  extension is justified. This is the primary reason Broken By End is
  tracked on the target zone.
- **MAE-based entry-tightening study**: for the Nat MAE R distribution
  segmented by Setup Type, compute the 20th percentile per family. That
  percentile represents a tightening level where 80% of historically
  filled winners would still have filled. Compare the resulting
  hypothetical R uplift against the fill-rate loss to decide whether
  entry tightening beyond current practice is net positive. Do NOT use
  the mean.
- **Intraday vs Swing R comparison**: for each Setup Type × Phase
  combination, compare Optimized R (intraday) against Swing Opt R for
  the same rows. If swing consistently adds R without proportional loss
  rate, the setup has a swing variant worth documenting. Consider only
  rows where Swing Valid = Yes.

Do not treat any of the above as validated conclusions yet — the dataset
is at n≈2 as of this spec's writing. The dashboard should make it easy to
re-run these views as data accumulates, and should visibly show sample
size next to any statistic (and probably gray out / caveat anything under
~30 rows).
