# Demo3 — Concordium Agent Registry in an x402 Payment Flow

## The Story

An AI agent wants to purchase a protected digital resource on behalf of a buyer.

Before allowing the payment, the x402 Gateway must answer several questions:

- Did the buyer genuinely authorize this agent?
- Does the acting agent control the cryptographic key it presents?
- Does that key match the agent identity registered on Concordium?
- Is the agent’s registered metadata authentic and untampered?
- Does the agent have the capabilities required for this transaction?
- Is the registry evidence current and finalized?
- Does the buyer satisfy the resource policy?

Only when every required check succeeds may the payment proceed.

---

## Core Message

**Concordium’s Agent Registry adds a verifiable trust layer to agent-driven x402 payments.**

A payment is permitted only when:

1. the buyer’s delegation is cryptographically valid;
2. the acting agent proves control of its delegated key;
3. the key is bound to the registered agent identity;
4. the registered Agent Card is authentic and capable;
5. the registry evidence is sufficiently fresh;
6. the buyer satisfies the protected-resource policy; and
7. the payment finalizes successfully.

Agent identity is therefore not merely displayed or looked up. It becomes an enforceable prerequisite inside the x402 payment flow.

---

## What the Demo Shows

The demo runs six controlled authorization paths.

The first five paths are rejected safely before payment. The sixth path completes a real Concordium Testnet payment and protected-resource release.

| Path | Scenario | Expected outcome |
| --- | --- | --- |
| 1 | Invalid buyer signature | Rejected before registry evaluation, policy, or payment |
| 2 | Invalid agent proof-of-possession | Rejected before policy or payment |
| 3 | Acting key does not match the registered agent key | Rejected and recorded in the authorization audit |
| 4 | Agent Card content has been tampered with | Rejected and recorded in the authorization audit |
| 5 | Valid registered agent acting for an ineligible buyer | Buyer policy denies access before payment |
| 6 | Valid registered agent acting for an eligible buyer | Authorization succeeds and the x402 payment flow completes |

---

## The Successful Payment Path

In Path 6, all required authorization and policy checks succeed.

The demo then:

1. creates the x402 payment record;
2. submits one real `0.050101 EUDemo` payment on Concordium Testnet;
3. waits for transaction finalization and indexing;
4. fulfills the Concordium Receipt Protocol payment;
5. obtains the receipt;
6. redeems the receipt against the protected resource;
7. releases the protected resource; and
8. rejects a replay or second use.

This demonstrates the complete progression:

**buyer authorization → agent verification → registry trust → buyer policy → payment → receipt → resource release → replay protection**

---

## Live and Controlled Evidence

The demo deliberately distinguishes two evidence sources.

### Live Concordium evidence

A read-only check verifies the deployed Concordium CIS-8004 Agent Registry boundary, including:

- the pinned Testnet registry contract;
- token existence;
- contract module identity; and
- finalized registry snapshot evidence.

### Controlled Agent Registry evidence

Controlled evidence is used for the complete positive and negative CIS-8004, CIS-8, and Agent Card scenarios.

This is necessary because the currently available Testnet token `0` verifies the live registry-read boundary but is not presented as a complete positive Agent Card fixture.

There is no automatic fallback between live and controlled evidence.

---

## Safety Boundaries

The demo:

- runs on Concordium Testnet;
- submits exactly one payment, only in the successful path;
- prevents rejected paths from entering payment;
- does not display private keys;
- does not display the raw receipt JWS;
- does not display the raw transaction hash;
- preserves sanitized authorization-audit evidence;
- enforces bounded use;
- verifies replay rejection; and
- keeps production activation disabled.

---

## What Viewers Should Take Away

A registered agent is not trusted merely because a registry token exists.

The complete trust decision requires agreement between:

- the buyer-signed delegation;
- the agent’s proof-of-possession;
- the Agent Registry identity;
- the registered CIS-8 key;
- the Agent Card integrity hash;
- the Agent Card capabilities;
- finalized freshness evidence;
- lifecycle and bounded-use controls; and
- buyer policy.

Only after those conditions succeed does the existing x402 payment and resource-release flow become available.

## Final Takeaway

**Concordium’s Agent Registry makes agent identity, key ownership, metadata integrity, capabilities, and freshness enforceable within an end-to-end x402 payment transaction.**
