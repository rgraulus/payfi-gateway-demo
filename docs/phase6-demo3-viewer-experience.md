# Phase 6 Demo3 Viewer Experience and Presenter Runbook

## Status

PR #305 provides the viewer-facing presentation layer for the completed Phase 6 Demo3 Agent Registry acceptance flow.

It does not replace or modify the merged PR #304 engineering runner.

The viewer runner invokes the frozen engineering runner, interprets its verified evidence, and presents the result as one coherent audience story.

The primary demo command is:

    npm run demo:x402-v2-agent-registry-demo3-viewer

That command runs the complete Demo3 experience, including exactly one real Concordium Testnet payment in the successful path.

Production activation remains disabled.

---

## 1. Demo Objective

Demo3 demonstrates how Concordium’s Agent Registry becomes an enforceable trust layer inside an agent-driven x402 payment flow.

An AI agent attempts to purchase a protected digital resource on behalf of a buyer.

Before permitting payment, the Gateway must establish that:

1. the buyer genuinely authorized the agent;
2. the agent controls its delegated acting key;
3. the acting key matches the key bound to the registered agent identity;
4. the Agent Card has not been altered;
5. the Agent Card advertises the required capabilities;
6. the registry evidence is sufficiently fresh and finalized;
7. the delegation remains current, unrevoked, and within its usage bound;
8. the buyer satisfies the protected-resource policy; and
9. the payment finalizes successfully.

Only after every required authorization and policy gate succeeds may the x402 payment flow continue.

---

## 2. Core Message

**Concordium’s Agent Registry is not merely an identity directory.**

Registry identity, key ownership, Agent Card integrity, capabilities, and freshness become enforceable prerequisites inside the x402 payment transaction.

The complete demonstrated lifecycle is:

    buyer authorization
      → agent proof-of-possession
      → Agent Registry identity and key binding
      → Agent Card integrity, capability, and freshness
      → delegation lifecycle and bounded use
      → buyer policy
      → Concordium Testnet payment
      → CRP receipt
      → protected-resource release
      → replay rejection

---

## 3. Single-Command Experience

From the `payfi-gateway-demo` repository root, run:

    npm run demo:x402-v2-agent-registry-demo3-viewer

The viewer command:

1. introduces the scenario and core message;
2. explains the six paths before execution;
3. discloses the live and controlled evidence boundaries;
4. invokes the frozen PR #304 engineering runner;
5. captures all engineering output in a timestamped log;
6. shows the audience only the relevant narrative and outcomes;
7. submits exactly one payment in the successful path;
8. fails closed if expected evidence is missing;
9. fails closed if more than one payment submission is observed;
10. prints a final capability summary; and
11. cleans up viewer-owned temporary state.

The presenter does not need to run the PR #304 runner separately.

---

## 4. Payment Notice

The primary viewer command performs a real Testnet payment.

| Item | Value |
| --- | --- |
| Network | Concordium Testnet |
| Asset | EUDemo |
| Amount | `0.050101 EUDemo` |
| Payments in Paths 1–5 | None |
| Payments in Path 6 | Exactly one |
| Finalization behavior | Payment helper runs with `--wait` |
| Production activation | Disabled |

Running the viewer command is an intentional operator action to execute the controlled Testnet demonstration.

It is not a production release or production-activation command.

---

## 5. Required Platform Readiness

The viewer command manages its dedicated Demo3 Gateway process through the frozen PR #304 runner.

The supporting platform must already be available.

### Required services

- Concordium Testnet node and wallet-proxy stack;
- Facilitator at `http://127.0.0.1:8080`;
- CRP stream worker running before payment submission;
- PostgreSQL container `xcf-pg`;
- `transaction-outcome` database;
- funded Testnet payer wallet;
- sufficient EUDemo balance for `0.050101 EUDemo`;
- sufficient CCD balance for transaction fees.

### Required local tools

- Node.js;
- npm;
- Bash;
- curl;
- jq;
- Docker;
- Python;
- base64 utilities; and
- local project dependencies, including `ts-node`.

### Gateway port

The managed runner expects no Gateway to be running at:

    http://localhost:3005

If a Gateway is already reachable there, the demo fails closed rather than reusing an unknown process.

---

## 6. Supporting Stack Commands

The Facilitator is started from:

    ~/Documents/GitHub/xcf-concordium-facilitator

with:

    npm run start

The CRP stream worker must be running before the payment is submitted.

The viewer runner checks the required runtime boundaries and stops if the necessary services, database, wallet, or ports are not ready.

---

## 7. Evidence Model

Demo3 deliberately distinguishes live registry grounding from controlled full-path evidence.

### 7.1 Live Concordium registry grounding

The demo first runs the read-only CIS-8004 live smoke against the pinned Concordium Testnet Agent Registry contract.

This validates the live registry-read boundary, including:

- the configured registry contract;
- token existence;
- missing-token behavior;
- pinned module identity;
- finalized snapshot evidence;
- owner-account presence; and
- agent-wallet presence.

The live smoke does not submit a payment or release a resource.

### 7.2 Controlled full-path registry evidence

The complete six-path matrix uses tightly guarded controlled evidence for:

- CIS-8004 identity;
- CIS-8 external key binding;
- Agent Card integrity;
- capability enforcement;
- freshness enforcement;
- acting-key mismatch;
- tampered Agent Card behavior; and
- the positive Agent Registry authorization path.

Controlled evidence is required because the currently available Testnet token `0` validates the live registry-read boundary but is not represented as a complete positive Agent Card fixture.

### 7.3 No fallback

There is no automatic fallback:

- from live evidence to controlled evidence; or
- from controlled evidence to live evidence.

Each evidence source is identified and used only for its stated purpose.

---

## 8. Six-Path Audience Flow

The viewer presents six paths as one coherent Agent Registry-integrated x402 story.

For every path, it explains:

- **WHAT WE ARE TESTING**
- **EXPECTED RESULT**
- **OBSERVED RESULT**
- **WHY IT MATTERS**

### Path 1 — Invalid buyer signature

#### What is tested

Whether an agent can use a forged or altered buyer delegation.

#### Expected result

Reject before Agent Registry evaluation, buyer policy, or payment.

#### Required observed result

- buyer signature rejected;
- Phase 6 Agent Registry evaluation not reached;
- buyer policy not evaluated;
- bounded use not consumed;
- payment not attempted;
- resource not released.

#### Why it matters

An agent cannot invent or alter the buyer’s delegated authority.

---

### Path 2 — Invalid agent proof-of-possession

#### What is tested

Whether an agent can use a delegated key without proving that it controls the key.

#### Expected result

Reject before buyer policy or payment.

#### Required observed result

- buyer delegation accepted;
- delegated agent key recovered;
- agent proof-of-possession rejected;
- buyer policy not evaluated;
- bounded use not consumed;
- payment not attempted;
- resource not released.

#### Why it matters

A valid delegation is insufficient unless the acting agent proves control of the delegated key.

---

### Path 3 — Acting-key mismatch

#### What is tested

Whether an otherwise authenticated acting key may differ from the key bound to the registered agent identity.

#### Expected result

Reject at the Agent Registry identity-to-key-binding boundary and record a sanitized audit row.

#### Required observed result

- Phase 5 cryptographic authorization reaches Phase 6;
- registry identity is resolved;
- registered key differs from the verified acting key;
- request rejected;
- append-only authorization audit persisted;
- payment not attempted;
- resource not released.

#### Why it matters

The executing key must be the key that the registry evidence binds to the registered agent.

---

### Path 4 — Tampered Agent Card

#### What is tested

Whether altered agent metadata can pass after registry identity and key verification.

#### Expected result

Reject when the delivered Agent Card bytes do not match the integrity hash bound through the registry evidence.

#### Required observed result

- registry identity and key evidence accepted;
- delivered Agent Card integrity check fails;
- request rejected;
- append-only authorization audit persisted;
- payment not attempted;
- resource not released.

#### Why it matters

Valid identity and key ownership cannot legitimize altered metadata or capabilities.

---

### Path 5 — Valid registered agent with ineligible buyer

#### What is tested

Whether a trustworthy and registry-authorized agent can override buyer eligibility policy.

#### Expected result

Authorize the agent, deny the buyer, and stop before payment.

#### Required observed result

- buyer delegation verified;
- agent proof-of-possession verified;
- Agent Registry identity and key binding accepted;
- Agent Card integrity and capabilities accepted;
- freshness accepted;
- buyer policy evaluated;
- buyer policy denied;
- bounded use not consumed;
- payment not attempted;
- resource not released.

#### Why it matters

Agent trust and buyer permission are separate requirements.

A trustworthy agent does not gain authority to bypass buyer policy.

---

### Path 6 — Valid registered agent with eligible buyer

#### What is tested

Whether the complete Agent Registry-authorized x402 lifecycle succeeds when every required condition is valid.

#### Expected result

Authorize the request, consume the bounded-use delegation once, submit one payment, obtain a receipt, release the resource once, and reject replay.

#### Required authorization checkpoint

- buyer delegation verified;
- agent proof-of-possession verified;
- Agent Registry identity accepted;
- registered acting key matched;
- Agent Card integrity verified;
- required capabilities present;
- freshness evidence accepted;
- delegation current and unrevoked;
- buyer policy satisfied;
- bounded-use authorization consumed once;
- payment-eligibility handoff present.

#### Required payment continuation

1. create the CRP payment record;
2. submit one `0.050101 EUDemo` Testnet transfer;
3. wait for finalization;
4. locate the indexed transfer;
5. fulfill CRP;
6. obtain the receipt JWS;
7. redeem the receipt;
8. require `PAYMENT-RESPONSE`;
9. verify the protected resource;
10. retry the receipt; and
11. reject replay or second use.

#### Why it matters

This proves that Agent Registry trust is an enforceable payment prerequisite rather than an isolated identity check.

---

## 9. Audience Output Contract

The default terminal output is intentionally concise.

The viewer displays:

- the scenario;
- the core message;
- the six planned paths;
- payment and evidence disclosures;
- live registry grounding;
- each path’s audience-facing result;
- the Path 6 payment progression;
- the final capability summary; and
- the detailed-log location.

Low-level Gateway, helper, database, and HTTP output is hidden from the default audience view.

The viewer does not print:

- private keys;
- raw temporary key material;
- the raw transaction hash;
- the raw receipt JWS;
- the raw `PAYMENT-RESPONSE`;
- protected-resource payload contents; or
- raw authorization-audit database rows.

---

## 10. Detailed Engineering Log

All output from the frozen PR #304 engineering runner is retained in:

    .tmp/demo3-viewer-logs/demo3-viewer-<run-id>.log

The viewer prints the exact log path at startup and completion.

The log is intended for:

- engineering verification;
- troubleshooting;
- audit review;
- evidence-anchor inspection; and
- confirmation that the viewer accurately represented the underlying run.

The log must not be treated as an audience handout.

---

## 11. Viewer Modes

### Default mode

The primary command uses concise audience mode:

    npm run demo:x402-v2-agent-registry-demo3-viewer

Detailed engineering output is captured but not echoed.

### Verbose engineering display

For troubleshooting, the presenter may set:

    DEMO3_VIEWER_VERBOSE=true

This echoes underlying engineering output with an `[engineering]` prefix while retaining the normal viewer narrative.

Verbose mode does not change authorization, payment, or production behavior.

### Presentation pacing

The default viewer adds a short pause between major audience sections.

The delay may be adjusted through:

    DEMO_PACE_SECONDS

Examples:

    DEMO_PACE_SECONDS=0

or:

    DEMO_PACE_SECONDS=1

Pacing changes presentation timing only.

It does not change network polling, payment finalization, authorization, or settlement behavior.

---

## 12. Fail-Closed Viewer Guards

The viewer refuses to report success unless every required evidence marker is observed.

Required markers include:

- live registry smoke passed;
- Path 1 rejection;
- Path 2 rejection;
- Path 3 rejection and audit;
- Path 4 rejection and audit;
- Path 5 policy denial without consumption;
- Path 6 bounded-use authorization;
- append-only audit retention;
- live payment phase entered;
- payment submitted;
- transfer indexed;
- CRP fulfilled;
- receipt obtained;
- resource released;
- replay blocked; and
- final Demo3 completion.

The viewer also counts payment-submission evidence.

Success requires:

    payment submission count = 1

A missing marker or duplicate payment-submission marker causes the viewer to fail closed.

---

## 13. Successful Final Screen

A successful run concludes with a capability summary equivalent to:

    [PASS] Live Concordium CIS-8004 registry boundary verified
    [PASS] Invalid buyer authorization rejected before registry and payment
    [PASS] Invalid agent possession proof rejected before policy and payment
    [PASS] Acting-key mismatch rejected and audited
    [PASS] Tampered Agent Card rejected and audited
    [PASS] Registry-valid agent could not override buyer policy
    [PASS] Eligible buyer and registered agent authorized
    [PASS] Exactly one 0.050101 EUDemo Testnet payment submitted
    [PASS] Finalized transfer indexed and CRP fulfilled
    [PASS] Receipt redeemed and protected resource released
    [PASS] Bounded-use authorization consumed once
    [PASS] Replay or second use rejected
    [PASS] Append-only sanitized authorization audit retained
    [PASS] Production activation remained disabled

The completion sentinels are:

    PR305_DEMO3_VIEWER_PAYMENT_SUBMISSION_COUNT=1
    PR305_DEMO3_VIEWER_PRODUCTION_ACTIVATION=false
    PR305_DEMO3_VIEWER_COMPLETE=true

---

## 14. Presentation-Contract Test

The no-payment viewer test is:

    npm run phase6:demo3-viewer-experience-test

This test does not invoke:

- Concordium;
- the live registry;
- the Gateway;
- CRP;
- the wallet;
- PostgreSQL;
- payment;
- receipt issuance;
- protected-resource release; or
- the frozen PR #304 engineering runner.

It uses a temporary mock engineering runner to validate:

- the complete six-path narrative;
- required audience sections;
- the detailed-log contract;
- exactly-one-payment evidence enforcement;
- missing-evidence rejection;
- cleanup behavior; and
- production activation remaining false.

This is the CI-safe validation entry point.

It is not the primary audience demo.

---

## 15. Presenter Guidance

Before running the demo:

1. distribute `docs/phase6-demo3-audience-brief.md`;
2. confirm the supporting stack is healthy;
3. confirm the CRP stream worker is running;
4. confirm the payer wallet is funded;
5. confirm port `3005` is free;
6. enlarge the terminal font;
7. use the default concise mode; and
8. explain that one Testnet payment will occur in Path 6.

Suggested opening statement:

> An AI agent wants to purchase a protected resource for a buyer.
> This demo shows five cases where the Gateway refuses to pay, followed by the one complete condition under which the Agent Registry-authorized x402 payment succeeds.

Suggested transition before Path 6 payment:

> The buyer authorization, agent possession proof, registered identity, acting key, Agent Card, freshness, lifecycle controls, and buyer policy have all passed. Only now may payment begin.

Suggested closing statement:

> Concordium’s Agent Registry did not merely describe the agent. It helped determine whether the agent-driven x402 payment was allowed to happen.

---

## 16. Failure Handling

If the viewer command fails:

1. do not immediately rerun the payment demo;
2. note the displayed engineering-log path;
3. inspect the final viewer message;
4. review the retained engineering log;
5. verify whether a payment was submitted before the failure;
6. verify CRP and canonical payment state before retrying;
7. correct the supporting-stack issue; and
8. rerun only after the previous state is understood.

This is especially important when a failure occurs after:

    PLT transfer submitted: true

A shell failure after transfer submission does not imply that the on-chain transfer failed.

---

## 17. Cleanup

The frozen PR #304 runner owns cleanup of:

- its dedicated Gateway process;
- temporary cryptographic key material;
- controlled evidence manifests;
- temporary request and response artifacts; and
- mutable demo lifecycle state identified by the runner.

The viewer owns cleanup of its temporary marker state.

The detailed engineering log is deliberately retained.

Append-only Phase 6 authorization-audit rows are deliberately retained as sanitized evidence.

---

## 18. Hard Scope Boundaries

PR #305 does not:

- change Gateway authorization behavior;
- change Phase 5 delegation verification;
- change Phase 6 Agent Registry resolution;
- change CIS-8004 or CIS-8 interpretation;
- change Agent Card validation;
- change freshness evaluation;
- change buyer policy;
- change lifecycle or bounded-use behavior;
- change CRP behavior;
- change payment submission;
- change receipt handling;
- change protected-resource release;
- change replay protection;
- add a database migration;
- modify the frozen PR #304 engineering runner;
- create automatic live-to-controlled fallback;
- create automatic controlled-to-live fallback; or
- enable production activation.

PR #305 is a viewer, narrative, documentation, and presentation-contract layer over the completed PR #304 behavior.

---

## 19. Definition of Done

PR #305 is complete when:

- one primary viewer command is available;
- the command explains the Demo3 story before execution;
- all six controlled positive and negative paths are presented clearly;
- Path 6 performs exactly one real Testnet payment;
- payment, receipt, release, and replay outcomes are understandable;
- live and controlled evidence are disclosed honestly;
- the detailed engineering log is retained;
- the no-payment presentation-contract test passes;
- the audience brief is available;
- production activation remains disabled;
- the PR #304 engineering runner remains unchanged; and
- the full viewer run passes under explicit operator authorization.
