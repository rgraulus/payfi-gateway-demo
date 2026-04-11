# MCA Stage 4 — Gated Acceptance Pack

## Objective

This acceptance pack validates the gated `/paid-gated` flow end to end.

It confirms that:

1. the non-gated `/paid` route remains unchanged
2. the gated route issues a policy-bearing challenge
3. policy evaluation moves the canonical challenge to `POLICY_SATISFIED`
4. downstream settlement entry is blocked unless canonical policy state is satisfied
5. a real facilitator receipt on `/paid-gated` advances the canonical lifecycle into settlement workflow

This pack is written for the current manual-payment validation mode.

---

## Scope

This pack covers the Gateway-side gated flow introduced during MCA Stage 4.

It assumes:
- Gateway is the canonical source of challenge state
- CRP / facilitator issues the payment receipt
- Concordium PLT payment is made manually
- settlement and release persistence are decoupled from request serving where currently implemented

This pack does **not** assume a fully automated payment sender.

---

## Preconditions

Before starting, make sure these are already running:

- Gateway
- Facilitator / CRP
- stream worker
- upstream server if needed by the current local topology
- Postgres and the rest of the local stack
- funded wallet ready to send `EUDemo`

Important lesson from validation:
do not issue the gated nonce until all runtime pieces are already up.

---

## Gateway startup

Run the Gateway with a longer TTL to give enough room for manual payment.

```bash
cd ~/Documents/GitHub/payfi-gateway-demo

git switch main
git fetch --prune
git pull --ff-only
git status

export DATABASE_URL="postgres://postgres:pg@localhost:5432/transaction-outcome"
export ORCHESTRATOR_BASE_URL="http://localhost:8090"
export ORCHESTRATOR_API_KEY="dev-internal-key"
export CRP_BASE_URL="http://127.0.0.1:8080"
export X402_TTL_SEC="1800"

npm run dev
```

---

## Terminal layout

Use at least two terminals.

Terminal A:
- Gateway logs

Terminal B:
- acceptance commands
- DB verification queries

Optional extra terminals:
- Facilitator / CRP logs
- stream worker logs
- upstream server logs

---

## Shared variables

In Terminal B:

```bash
GW=http://localhost:3005
CRP=http://127.0.0.1:8080
```

---

## Section 1 — Non-gated regression check

Goal:
confirm `/paid` still behaves as the normal non-gated flow.

```bash
curl -sS -i "$GW/paid"
```

Expected outcome:
- HTTP `402 Payment Required`
- ordinary non-gated `PAYMENT-REQUIRED`
- no gated-policy-specific error

---

## Section 2 — Fresh gated challenge issuance

Goal:
issue a fresh gated challenge and capture the nonce.

```bash
curl -sS -D /tmp/stage43-gated-headers.txt -o /tmp/stage43-gated-body.json "$GW/paid-gated" >/dev/null

PR_B64="$(awk -F': ' 'tolower($1)=="payment-required"{print $2}' /tmp/stage43-gated-headers.txt | tr -d '\r')"
printf '%s' "$PR_B64" | base64 -d > /tmp/stage43-gated-pr.json

echo "=== decoded gated PAYMENT-REQUIRED ==="
jq '{nonce,issuedAt,expiresAt,contractId,resource,network,asset,amount,payTo,policyRequired,policyVersion,policyKind}' /tmp/stage43-gated-pr.json

NONCE="$(jq -r '.nonce' /tmp/stage43-gated-pr.json)"
echo
echo "NONCE=$NONCE"
```

Expected outcome:
- `policyRequired = true`
- `policyVersion = "v1"`
- `policyKind = "composite"`
- nonce captured for the rest of the run

---

## Section 3 — Policy evaluation

Goal:
move the canonical challenge to `POLICY_SATISFIED`.

```bash
curl -sS -i -X POST "$GW/paid-gated/redeem" \
  -H 'content-type: application/json' \
  -d '{
    "nonce":"'"$NONCE"'",
    "policyEvidence":{
      "nonce":"'"$NONCE"'",
      "policyKind":"composite",
      "region":"EU",
      "claims":{"ageOver":18}
    }
  }'
```

Expected outcome:
- HTTP `200 OK`
- `policyStatus = POLICY_SATISFIED`

Verify DB state:

```bash
docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT nonce, status, release_status, updated_at
FROM payment_challenges
WHERE nonce = '$NONCE';
"

docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT
  gst.created_at,
  gst.from_state,
  gst.to_state,
  gst.actor,
  gst.reason_code,
  gst.reason_message
FROM gateway_state_transitions gst
JOIN payment_challenges pc
  ON pc.challenge_id = gst.challenge_id
WHERE pc.nonce = '$NONCE'
ORDER BY gst.created_at ASC;
"
```

Expected outcome:
- `status = POLICY_SATISFIED`
- transitions include:
  - `ISSUED -> POLICY_SATISFIED`

---

## Section 4 — Build CRP create payload

Goal:
prepare a CRP payment request for the same nonce.

Important:
CRP expects `expiry` as ISO-8601, not raw epoch seconds.

Copy the current PR into a repo-local file:

```bash
cp /tmp/stage43-gated-pr.json stage43-real-gated-pr.json
cat stage43-real-gated-pr.json | jq '{nonce, expiresAt}'
```

Build the CRP create payload:

```bash
python - <<'PY'
import json
from datetime import datetime, timezone
from pathlib import Path

pr = json.loads(Path("stage43-real-gated-pr.json").read_text(encoding="utf-8"))

payload = {
    "merchantId": pr["merchantId"],
    "nonce": pr["nonce"],
    "network": pr["network"],
    "payTo": pr["payTo"],
    "amount": pr["amount"],
    "asset": pr["asset"],
    "expiry": datetime.fromtimestamp(
        pr["expiresAt"], tz=timezone.utc
    ).isoformat().replace("+00:00", "Z"),
    "metadata": {
        "contract": pr
    }
}

Path("stage43-crp-create.json").write_text(
    json.dumps(payload, separators=(",", ":")),
    encoding="utf-8"
)
print("Wrote stage43-crp-create.json")
PY
```

Inspect:

```bash
cat stage43-crp-create.json | jq '{nonce, expiry}'
```

Expected outcome:
- nonce matches the current run
- expiry is ISO-8601 UTC

---

## Section 5 — Create CRP payment

Goal:
create the facilitator-side pending payment for the exact gated nonce.

```bash
curl -sS -i -X POST "$CRP/v1/crp/payments" \
  -H 'content-type: application/json' \
  -d @stage43-crp-create.json
```

Expected outcome:
- HTTP `200 OK`
- `reason = "created"`
- payment `status = "pending"`

Confirm the current nonce exists in CRP `challenges`:

```bash
docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT
  merchant_id,
  nonce,
  network,
  amount,
  pay_to,
  expiry,
  status,
  created_at,
  updated_at
FROM challenges
WHERE nonce = '$NONCE'
ORDER BY created_at DESC;
"
```

Expected outcome:
- one row
- `status = pending`

---

## Section 6 — Manual PLT payment

Goal:
make the actual `EUDemo` payment for the same nonce.

Print the payment details:

```bash
cat stage43-real-gated-pr.json | jq '{nonce, amount, payTo, network, asset}'
```

Use the wallet to send:

- token: `EUDemo`
- amount: `0.050101`
- destination: printed `payTo`
- memo/nonce: the same `$NONCE` if supported

Once sent, set the tx hash:

```bash
TX="<paste-real-tx-hash-here>"
echo "TX=$TX"
```

---

## Section 7 — Wait for indexed PLT event

Goal:
confirm CRP sees the on-chain transfer.

```bash
echo "=== wait for indexed PLT event ==="
until curl -sS "$CRP/v1/crp/plt/search?network=concordium:testnet&txHash=$TX&limit=1" \
  | tee /tmp/stage43-plt-search.json \
  | jq -e '.events | length > 0' >/dev/null; do
  sleep 1
done

jq . /tmp/stage43-plt-search.json
```

Expected outcome:
- `events` non-empty
- correct `to_addr`
- correct `amount_minor = 50101`

---

## Section 8 — Fulfill the payment

Goal:
match the indexed event to the pending facilitator challenge and obtain a receipt.

Use the exact PR fields plus `txHash`:

```bash
jq -c --arg tx "$TX" '{
  merchantId,
  nonce,
  network,
  payTo,
  amount,
  asset,
  txHash: $tx
}' stage43-real-gated-pr.json \
| curl -sS -i -X POST "$CRP/v1/crp/payments/fulfill" \
    -H 'content-type: application/json' \
    -d @-
```

Expected outcome:
- HTTP `200 OK`
- `reason = "exact_match"`
- payment `status = "fulfilled"`
- receipt JWS present in the response

---

## Section 9 — Retrieve receipt safely

Important lesson:
do not rely on `payments/search?...nonce=...` alone.
The safer pattern is to search broadly and filter locally by nonce.

```bash
curl -sS "$CRP/v1/crp/payments/search?merchantId=demo-merchant&network=concordium:testnet&limit=20" \
| tee /tmp/stage43-payments-search-all.json \
| jq '.matches[] | select(.nonce == "'"$NONCE"'")'
```

Extract the receipt JWS:

```bash
RECEIPT_JWS="$(jq -r '.matches[] | select(.nonce == "'"$NONCE"'") | .receipt.jws' /tmp/stage43-payments-search-all.json)"
echo "RECEIPT_JWS length: ${#RECEIPT_JWS}"
```

Expected outcome:
- current nonce found
- `status = fulfilled`
- `receipt.jws` present

---

## Section 10 — Redeem the real receipt against `/paid-gated`

Goal:
prove the gated route accepts the real facilitator receipt after policy satisfaction.

```bash
curl -sS -i "$GW/paid-gated?nonce=$NONCE" \
  -H "x402-receipt: $RECEIPT_JWS"
```

Expected outcome:
- HTTP `200 OK`
- `paid = true`
- `PAYMENT-RESPONSE` header present

---

## Section 11 — Verify final canonical gateway state

Goal:
confirm the gated route advanced beyond `POLICY_SATISFIED`.

```bash
docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT
  nonce,
  status,
  release_status,
  updated_at
FROM payment_challenges
WHERE nonce = '$NONCE';
"

docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT
  gst.created_at,
  gst.from_state,
  gst.to_state,
  gst.actor,
  gst.reason_code,
  gst.reason_message
FROM gateway_state_transitions gst
JOIN payment_challenges pc
  ON pc.challenge_id = gst.challenge_id
WHERE pc.nonce = '$NONCE'
ORDER BY gst.created_at ASC;
"
```

Expected outcome from the validated successful run:
- `status = SETTLEMENT_PENDING`
- transitions include:
  - `ISSUED`
  - `POLICY_SATISFIED`
  - `SETTLEMENT_REQUESTED`
  - `SETTLEMENT_PENDING`

---

## Acceptance criteria summary

The gated Stage 4 flow is accepted when all of the following are true:

- `/paid` remains unchanged and returns ordinary non-gated 402 behavior
- `/paid-gated` issues a policy-bearing challenge
- `/paid-gated/redeem` moves the canonical challenge to `POLICY_SATISFIED`
- a CRP payment can be created for the same nonce
- a real PLT payment can be indexed and fulfilled for the same nonce
- the facilitator issues a receipt for the same nonce
- redeeming that receipt against `/paid-gated` returns `200 OK`
- canonical gateway state advances beyond `POLICY_SATISFIED` into settlement workflow

---

## Known gotchas

### 1. Runtime readiness
Do not start until all runtime components are up:
- Gateway
- Facilitator
- stream worker
- supporting infra
- funded wallet ready

### 2. Gateway TTL
For manual payment, use a longer TTL:

```bash
export X402_TTL_SEC="1800"
```

### 3. CRP `expiry`
CRP create expects ISO-8601 `expiry`, not raw epoch `expiresAt`.

### 4. Windows Python path issues
Use repo-local files like:
- `stage43-real-gated-pr.json`
- `stage43-crp-create.json`

instead of relying on `/tmp/...` paths inside Windows Python.

### 5. CRP search by nonce
In this environment, broad search plus local `jq` filtering by nonce is safer than trusting the server-side nonce filter alone.

### 6. Fulfill `no_match`
If fulfill returns `no_match`, first verify the current nonce exists in CRP `challenges`:

```bash
docker exec -i xcf-pg psql -U postgres -d transaction-outcome -P pager=off -c "
SELECT merchant_id, nonce, network, amount, pay_to, expiry, status, created_at, updated_at
FROM challenges
WHERE nonce = '$NONCE'
ORDER BY created_at DESC;
"
```

If zero rows come back, recreate the CRP payment first.

### 7. Keep nonce alignment strict
Throughout the flow, keep these aligned:
- Gateway-issued nonce
- repo-local PR file nonce
- CRP challenge nonce
- fulfill nonce
- receipt nonce
- final gateway redeem nonce

Mixing runs will produce false negatives.

---

## Final interpretation

A successful run proves that the gated route is no longer a policy-only demo surface.
It participates in the real x402 payment and settlement lifecycle while preserving canonical gateway state discipline.
