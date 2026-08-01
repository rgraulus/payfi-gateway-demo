/**
 * Demo4 D4-1A — Phase 6 Concordium network-normalization CI harness.
 *
 * This harness exercises only the pure normalization seam. It performs no
 * network access, wallet access, signing, transaction construction or
 * submission, payment, registry mutation, persistence, Gateway activation,
 * protected-resource release, or production activation.
 */

import assert from "node:assert/strict";

import {
  PHASE6_CONCORDIUM_MAINNET_PAYMENT_ALIAS,
  PHASE6_CONCORDIUM_MAINNET_TEMPORARY_ALIAS,
  PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS,
  PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_SAFETY,
  PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
  PHASE6_CONCORDIUM_TESTNET_PAYMENT_ALIAS,
  PHASE6_CONCORDIUM_TESTNET_TEMPORARY_ALIAS,
  normalizePhase6ConcordiumRegistryIdentityV1,
  normalizePhase6ConcordiumTestnetNetworkV1,
  normalizePhase6ConcordiumTokenAddressV1,
  type Phase6ConcordiumNetworkNormalizationFailureV1,
  type Phase6ConcordiumRegistryIdentityNormalizationFailureV1,
  type Phase6ConcordiumTokenAddressNormalizationFailureV1,
} from "../src/phase6/concordiumNetworkNormalization";

import {
  CONCORDIUM_MAINNET_CHAIN_ID,
  CONCORDIUM_TESTNET_CHAIN_ID,
} from "../src/chainId";

const LABEL =
  "ci:phase6:concordium-network-normalization";

const CANONICAL_TESTNET =
  "ccd:4221332d34e1694168c2a0c0b3fd0f27";

const CANONICAL_MAINNET =
  "ccd:9dd9ca4d19e9393877d2c44b70f89acb";

type NetworkFailureReason =
  Phase6ConcordiumNetworkNormalizationFailureV1["reason"];

type TokenAddressFailureReason =
  Phase6ConcordiumTokenAddressNormalizationFailureV1["reason"];

type RegistryIdentityFailureReason =
  Phase6ConcordiumRegistryIdentityNormalizationFailureV1["reason"];

function assertNetworkAccepted(
  input: unknown,
): void {
  assert.deepEqual(
    normalizePhase6ConcordiumTestnetNetworkV1(
      input,
    ),
    {
      ok: true,
      status: "normalized",
      reason: "normalized",
      canonicalNetwork:
        CANONICAL_TESTNET,
    },
  );
}

function assertNetworkRejected(
  input: unknown,
  expectedReason: NetworkFailureReason,
): void {
  const result =
    normalizePhase6ConcordiumTestnetNetworkV1(
      input,
    );

  assert.deepEqual(
    result,
    {
      ok: false,
      status: "rejected",
      reason:
        expectedReason,
      canonicalNetwork:
        null,
    },
  );
}

function assertTokenAddressAccepted(
  input: unknown,
  expectedSuffix: string,
): void {
  assert.deepEqual(
    normalizePhase6ConcordiumTokenAddressV1(
      input,
    ),
    {
      ok: true,
      status: "normalized",
      reason: "normalized",
      canonicalNetwork:
        CANONICAL_TESTNET,
      tokenAddressSuffix:
        expectedSuffix,
      canonicalTokenAddress:
        `${CANONICAL_TESTNET}/${expectedSuffix}`,
    },
  );
}

function assertTokenAddressRejected(
  input: unknown,
  expectedReason:
    TokenAddressFailureReason,
): void {
  const result =
    normalizePhase6ConcordiumTokenAddressV1(
      input,
    );

  assert.deepEqual(
    result,
    {
      ok: false,
      status: "rejected",
      reason:
        expectedReason,
      canonicalNetwork:
        null,
      tokenAddressSuffix:
        null,
      canonicalTokenAddress:
        null,
    },
  );
}

function assertRegistryIdentityAccepted(
  network: unknown,
  tokenAddress: unknown,
  expectedSuffix: string,
): void {
  assert.deepEqual(
    normalizePhase6ConcordiumRegistryIdentityV1(
      {
        network,
        tokenAddress,
      },
    ),
    {
      ok: true,
      status: "normalized",
      reason: "normalized",
      network:
        CANONICAL_TESTNET,
      tokenAddress:
        `${CANONICAL_TESTNET}/${expectedSuffix}`,
    },
  );
}

function assertRegistryIdentityRejected(
  network: unknown,
  tokenAddress: unknown,
  expectedReason:
    RegistryIdentityFailureReason,
): void {
  const result =
    normalizePhase6ConcordiumRegistryIdentityV1(
      {
        network,
        tokenAddress,
      },
    );

  assert.deepEqual(
    result,
    {
      ok: false,
      status: "rejected",
      reason:
        expectedReason,
      network:
        null,
      tokenAddress:
        null,
    },
  );
}

function assertConstants(): void {
  assert.equal(
    CONCORDIUM_TESTNET_CHAIN_ID,
    CANONICAL_TESTNET,
  );

  assert.equal(
    PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
    CONCORDIUM_TESTNET_CHAIN_ID,
  );

  assert.equal(
    CONCORDIUM_MAINNET_CHAIN_ID,
    CANONICAL_MAINNET,
  );

  assert.equal(
    PHASE6_CONCORDIUM_TESTNET_PAYMENT_ALIAS,
    "concordium:testnet",
  );

  assert.equal(
    PHASE6_CONCORDIUM_TESTNET_TEMPORARY_ALIAS,
    "ccd:testnet",
  );

  assert.equal(
    PHASE6_CONCORDIUM_MAINNET_PAYMENT_ALIAS,
    "concordium:mainnet",
  );

  assert.equal(
    PHASE6_CONCORDIUM_MAINNET_TEMPORARY_ALIAS,
    "ccd:mainnet",
  );
}

function assertClosedReasonContract(): void {
  assert.deepEqual(
    PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS,
    [
      "normalized",
      "invalid_network_input",
      "unsupported_network",
      "mainnet_not_allowed",
      "invalid_token_address_shape",
      "invalid_token_address_network",
      "network_token_address_mismatch",
    ],
  );

  assert.equal(
    new Set(
      PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS,
    ).size,
    PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS
      .length,
  );

  assert.ok(
    PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS
      .includes(
        "network_token_address_mismatch",
      ),
  );
}

function assertAcceptedNetworks(): void {
  assertNetworkAccepted(
    CANONICAL_TESTNET,
  );

  assertNetworkAccepted(
    "concordium:testnet",
  );

  assertNetworkAccepted(
    "ccd:testnet",
  );

  assertNetworkAccepted(
    PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
  );

  assertNetworkAccepted(
    PHASE6_CONCORDIUM_TESTNET_PAYMENT_ALIAS,
  );

  assertNetworkAccepted(
    PHASE6_CONCORDIUM_TESTNET_TEMPORARY_ALIAS,
  );
}

function assertRejectedNetworkInputs(): void {
  assertNetworkRejected(
    "",
    "invalid_network_input",
  );

  assertNetworkRejected(
    " ",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "   ",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "\t",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "\n",
    "invalid_network_input",
  );

  assertNetworkRejected(
    42,
    "invalid_network_input",
  );

  assertNetworkRejected(
    null,
    "invalid_network_input",
  );

  assertNetworkRejected(
    undefined,
    "invalid_network_input",
  );

  assertNetworkRejected(
    {},
    "invalid_network_input",
  );

  assertNetworkRejected(
    [],
    "invalid_network_input",
  );

  assertNetworkRejected(
    " ccd:testnet",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "ccd:testnet ",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "testnet",
    "invalid_network_input",
  );

  assertNetworkRejected(
    ":testnet",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "ccd:",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "CCD:testnet",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "ccd:test/net",
    "invalid_network_input",
  );

  assertNetworkRejected(
    "ccd:testnet-other",
    "unsupported_network",
  );

  assertNetworkRejected(
    "concordium:testnet-other",
    "unsupported_network",
  );

  assertNetworkRejected(
    "other:network",
    "unsupported_network",
  );

  assertNetworkRejected(
    "ethereum:1",
    "unsupported_network",
  );

  assertNetworkRejected(
    "ccd:4221332d34e1694168c2a0c0b3fd0f28",
    "unsupported_network",
  );

  assertNetworkRejected(
    PHASE6_CONCORDIUM_MAINNET_TEMPORARY_ALIAS,
    "mainnet_not_allowed",
  );

  assertNetworkRejected(
    PHASE6_CONCORDIUM_MAINNET_PAYMENT_ALIAS,
    "mainnet_not_allowed",
  );

  assertNetworkRejected(
    CONCORDIUM_MAINNET_CHAIN_ID,
    "mainnet_not_allowed",
  );
}

function assertAcceptedTokenAddresses(): void {
  assertTokenAddressAccepted(
    `${CANONICAL_TESTNET}/cis8004:5`,
    "cis8004:5",
  );

  assertTokenAddressAccepted(
    "concordium:testnet/cis8004:5",
    "cis8004:5",
  );

  assertTokenAddressAccepted(
    "ccd:testnet/cis8004:5",
    "cis8004:5",
  );

  assertTokenAddressAccepted(
    `${CANONICAL_TESTNET}/cis2:12802-0-0`,
    "cis2:12802-0-0",
  );

  assertTokenAddressAccepted(
    "concordium:testnet/cis2:12802-0-0",
    "cis2:12802-0-0",
  );

  assertTokenAddressAccepted(
    "ccd:testnet/cis2:12802-0-0",
    "cis2:12802-0-0",
  );

  assertTokenAddressAccepted(
    "ccd:testnet/future-asset:abc/def",
    "future-asset:abc/def",
  );
}

function assertRejectedTokenAddressInputs(): void {
  assertTokenAddressRejected(
    "",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    " ",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    42,
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    null,
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    undefined,
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    {},
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    [],
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "/cis8004:5",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/cis8004",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/:5",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/cis8004:",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/cis 8004:5",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    " ccd:testnet/cis8004:5",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "ccd:testnet/cis8004:5 ",
    "invalid_token_address_shape",
  );

  assertTokenAddressRejected(
    "testnet/cis8004:5",
    "invalid_token_address_network",
  );

  assertTokenAddressRejected(
    "ccd:testnet-other/cis8004:5",
    "invalid_token_address_network",
  );

  assertTokenAddressRejected(
    "concordium:testnet-other/cis8004:5",
    "invalid_token_address_network",
  );

  assertTokenAddressRejected(
    "ethereum:1/cis8004:5",
    "invalid_token_address_network",
  );

  assertTokenAddressRejected(
    "ccd:4221332d34e1694168c2a0c0b3fd0f28/cis8004:5",
    "invalid_token_address_network",
  );

  assertTokenAddressRejected(
    "ccd:mainnet/cis8004:5",
    "mainnet_not_allowed",
  );

  assertTokenAddressRejected(
    "concordium:mainnet/cis8004:5",
    "mainnet_not_allowed",
  );

  assertTokenAddressRejected(
    `${CANONICAL_MAINNET}/cis8004:5`,
    "mainnet_not_allowed",
  );
}

function assertRegistryIdentityCoherence(): void {
  assertRegistryIdentityAccepted(
    CANONICAL_TESTNET,
    `${CANONICAL_TESTNET}/cis8004:5`,
    "cis8004:5",
  );

  assertRegistryIdentityAccepted(
    "concordium:testnet",
    "concordium:testnet/cis8004:5",
    "cis8004:5",
  );

  assertRegistryIdentityAccepted(
    "ccd:testnet",
    "ccd:testnet/cis8004:5",
    "cis8004:5",
  );

  assertRegistryIdentityAccepted(
    "concordium:testnet",
    "ccd:testnet/cis8004:5",
    "cis8004:5",
  );

  assertRegistryIdentityAccepted(
    "ccd:testnet",
    `${CANONICAL_TESTNET}/cis2:12802-0-0`,
    "cis2:12802-0-0",
  );

  assertRegistryIdentityAccepted(
    CANONICAL_TESTNET,
    "concordium:testnet/cis2:12802-0-0",
    "cis2:12802-0-0",
  );

  assertRegistryIdentityRejected(
    "",
    "ccd:testnet/cis8004:5",
    "invalid_network_input",
  );

  assertRegistryIdentityRejected(
    "ccd:testnet-other",
    "ccd:testnet/cis8004:5",
    "unsupported_network",
  );

  assertRegistryIdentityRejected(
    "ccd:mainnet",
    "ccd:testnet/cis8004:5",
    "mainnet_not_allowed",
  );

  assertRegistryIdentityRejected(
    CANONICAL_MAINNET,
    "ccd:testnet/cis8004:5",
    "mainnet_not_allowed",
  );

  assertRegistryIdentityRejected(
    "ccd:testnet",
    "",
    "invalid_token_address_shape",
  );

  assertRegistryIdentityRejected(
    "ccd:testnet",
    "ccd:testnet-other/cis8004:5",
    "invalid_token_address_network",
  );

  assertRegistryIdentityRejected(
    "ccd:testnet",
    "ccd:mainnet/cis8004:5",
    "mainnet_not_allowed",
  );

  assertRegistryIdentityRejected(
    "ccd:testnet",
    `${CANONICAL_MAINNET}/cis8004:5`,
    "mainnet_not_allowed",
  );
}

function assertNoPartialAcceptedResults(): void {
  const invalidNetwork =
    normalizePhase6ConcordiumTestnetNetworkV1(
      "ccd:testnet-other",
    );

  assert.equal(
    invalidNetwork.ok,
    false,
  );

  assert.equal(
    invalidNetwork.canonicalNetwork,
    null,
  );

  const invalidTokenAddress =
    normalizePhase6ConcordiumTokenAddressV1(
      "ccd:testnet-other/cis8004:5",
    );

  assert.equal(
    invalidTokenAddress.ok,
    false,
  );

  assert.equal(
    invalidTokenAddress.canonicalNetwork,
    null,
  );

  assert.equal(
    invalidTokenAddress.tokenAddressSuffix,
    null,
  );

  assert.equal(
    invalidTokenAddress.canonicalTokenAddress,
    null,
  );

  const invalidIdentity =
    normalizePhase6ConcordiumRegistryIdentityV1(
      {
        network:
          "ccd:testnet",
        tokenAddress:
          "ccd:testnet-other/cis8004:5",
      },
    );

  assert.equal(
    invalidIdentity.ok,
    false,
  );

  assert.equal(
    invalidIdentity.network,
    null,
  );

  assert.equal(
    invalidIdentity.tokenAddress,
    null,
  );
}

function assertSuffixPreservation(): void {
  const suffixes = [
    "cis8004:5",
    "cis2:12802-0-0",
    "cis2:8004-0-42",
    "future-asset:abc.def_123-XYZ",
    "future-asset:abc/def",
  ] as const;

  for (const suffix of suffixes) {
    const result =
      normalizePhase6ConcordiumTokenAddressV1(
        `ccd:testnet/${suffix}`,
      );

    assert.equal(
      result.ok,
      true,
    );

    if (!result.ok) {
      assert.fail(
        `unexpected rejection for suffix ${suffix}`,
      );
    }

    assert.equal(
      result.tokenAddressSuffix,
      suffix,
    );

    assert.equal(
      result.canonicalTokenAddress,
      `${CANONICAL_TESTNET}/${suffix}`,
    );
  }
}

function assertDeterminism(): void {
  const networkInput =
    "concordium:testnet";

  const networkFirst =
    normalizePhase6ConcordiumTestnetNetworkV1(
      networkInput,
    );

  const networkSecond =
    normalizePhase6ConcordiumTestnetNetworkV1(
      networkInput,
    );

  assert.deepEqual(
    networkFirst,
    networkSecond,
  );

  const tokenAddressInput =
    "ccd:testnet/cis2:12802-0-0";

  const tokenFirst =
    normalizePhase6ConcordiumTokenAddressV1(
      tokenAddressInput,
    );

  const tokenSecond =
    normalizePhase6ConcordiumTokenAddressV1(
      tokenAddressInput,
    );

  assert.deepEqual(
    tokenFirst,
    tokenSecond,
  );

  const identityInput = {
    network:
      "concordium:testnet",
    tokenAddress:
      "ccd:testnet/cis8004:5",
  } as const;

  const identityFirst =
    normalizePhase6ConcordiumRegistryIdentityV1(
      identityInput,
    );

  const identitySecond =
    normalizePhase6ConcordiumRegistryIdentityV1(
      identityInput,
    );

  assert.deepEqual(
    identityFirst,
    identitySecond,
  );

  assert.deepEqual(
    identityInput,
    {
      network:
        "concordium:testnet",
      tokenAddress:
        "ccd:testnet/cis8004:5",
    },
  );
}

function assertSafetyProfile(): void {
  assert.equal(
    Object.isFrozen(
      PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_SAFETY,
    ),
    true,
  );

  assert.deepEqual(
    PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_SAFETY,
    {
      walletAccessed:
        false,
      signerCreated:
        false,
      signingAttempted:
        false,
      transactionConstructed:
        false,
      transactionSubmitted:
        false,
      paymentAttempted:
        false,
      registryMutated:
        false,
      databaseMutated:
        false,
      gatewayRuntimeActivated:
        false,
      resourceReleased:
        false,
      productionActivation:
        false,
    },
  );

  for (
    const [
      safetyName,
      safetyValue,
    ] of
      Object.entries(
        PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_SAFETY,
      )
  ) {
    assert.equal(
      safetyValue,
      false,
      `${safetyName} must remain false`,
    );
  }
}

function main(): void {
  console.log(
    `=== ${LABEL} ===`,
  );

  assertConstants();
  assertClosedReasonContract();
  assertAcceptedNetworks();
  assertRejectedNetworkInputs();
  assertAcceptedTokenAddresses();
  assertRejectedTokenAddressInputs();
  assertRegistryIdentityCoherence();
  assertNoPartialAcceptedResults();
  assertSuffixPreservation();
  assertDeterminism();
  assertSafetyProfile();

  console.log(
    `D4_1A_NETWORK_NORMALIZATION_CANONICAL_NETWORK=${CANONICAL_TESTNET}`,
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_ACCEPTED_NETWORK_MATRIX_PASSED=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_REJECTED_NETWORK_MATRIX_PASSED=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_TOKEN_ADDRESS_MATRIX_PASSED=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_IDENTITY_COHERENCE_PASSED=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_DETERMINISM_PASSED=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_NO_PARTIAL_ACCEPTED_RESULT=true",
  );

  console.log(
    "D4_1A_NETWORK_NORMALIZATION_ZERO_SIDE_EFFECT_PROFILE=true",
  );

  console.log(
    "D4_1A_NO_WALLET_SIGNER_SIGNING_TRANSACTION_PAYMENT_REGISTRY_MUTATION_RUNTIME_RELEASE_OR_PRODUCTION_ACTIVATION_OCCURRED=true",
  );

  console.log(
    "D4_1A_CONCORDIUM_NETWORK_NORMALIZATION_CI_PASSED=true",
  );
}

main();
