/**
 * Demo4 D4-1A — pure Phase 6 Concordium network normalization.
 *
 * This seam is intentionally limited to deterministic Testnet identifier and
 * token-address canonicalization. It performs no network access, wallet
 * access, signing, transaction construction or submission, payment, registry
 * mutation, persistence, runtime release, or production activation.
 */

import {
  CONCORDIUM_MAINNET_CHAIN_ID,
  CONCORDIUM_TESTNET_CHAIN_ID,
} from "../chainId";

export const PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK =
  CONCORDIUM_TESTNET_CHAIN_ID;

export const PHASE6_CONCORDIUM_TESTNET_PAYMENT_ALIAS =
  "concordium:testnet" as const;

export const PHASE6_CONCORDIUM_TESTNET_TEMPORARY_ALIAS =
  "ccd:testnet" as const;

export const PHASE6_CONCORDIUM_MAINNET_PAYMENT_ALIAS =
  "concordium:mainnet" as const;

export const PHASE6_CONCORDIUM_MAINNET_TEMPORARY_ALIAS =
  "ccd:mainnet" as const;

export const PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS = [
  "normalized",
  "invalid_network_input",
  "unsupported_network",
  "mainnet_not_allowed",
  "invalid_token_address_shape",
  "invalid_token_address_network",
  "network_token_address_mismatch",
] as const;

export type Phase6ConcordiumNetworkNormalizationReasonV1 =
  (typeof PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_REASONS)[number];

export type Phase6ConcordiumNetworkNormalizationSuccessV1 = {
  readonly ok: true;
  readonly status: "normalized";
  readonly reason: "normalized";
  readonly canonicalNetwork:
    typeof PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK;
};

export type Phase6ConcordiumNetworkNormalizationFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason:
    Exclude<
      Phase6ConcordiumNetworkNormalizationReasonV1,
      "normalized"
    >;
  readonly canonicalNetwork: null;
};

export type Phase6ConcordiumNetworkNormalizationResultV1 =
  | Phase6ConcordiumNetworkNormalizationSuccessV1
  | Phase6ConcordiumNetworkNormalizationFailureV1;

export type Phase6ConcordiumTokenAddressNormalizationSuccessV1 = {
  readonly ok: true;
  readonly status: "normalized";
  readonly reason: "normalized";
  readonly canonicalNetwork:
    typeof PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK;
  readonly tokenAddressSuffix: string;
  readonly canonicalTokenAddress: string;
};

export type Phase6ConcordiumTokenAddressNormalizationFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason:
    | "invalid_token_address_shape"
    | "invalid_token_address_network"
    | "mainnet_not_allowed";
  readonly canonicalNetwork: null;
  readonly tokenAddressSuffix: null;
  readonly canonicalTokenAddress: null;
};

export type Phase6ConcordiumTokenAddressNormalizationResultV1 =
  | Phase6ConcordiumTokenAddressNormalizationSuccessV1
  | Phase6ConcordiumTokenAddressNormalizationFailureV1;

export type Phase6ConcordiumRegistryIdentityNormalizationInputV1 = {
  readonly network: unknown;
  readonly tokenAddress: unknown;
};

export type Phase6ConcordiumRegistryIdentityNormalizationSuccessV1 = {
  readonly ok: true;
  readonly status: "normalized";
  readonly reason: "normalized";
  readonly network:
    typeof PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK;
  readonly tokenAddress: string;
};

export type Phase6ConcordiumRegistryIdentityNormalizationFailureV1 = {
  readonly ok: false;
  readonly status: "rejected";
  readonly reason:
    Exclude<
      Phase6ConcordiumNetworkNormalizationReasonV1,
      "normalized"
    >;
  readonly network: null;
  readonly tokenAddress: null;
};

export type Phase6ConcordiumRegistryIdentityNormalizationResultV1 =
  | Phase6ConcordiumRegistryIdentityNormalizationSuccessV1
  | Phase6ConcordiumRegistryIdentityNormalizationFailureV1;

export const PHASE6_CONCORDIUM_NETWORK_NORMALIZATION_SAFETY = Object.freeze({
  walletAccessed: false,
  signerCreated: false,
  signingAttempted: false,
  transactionConstructed: false,
  transactionSubmitted: false,
  paymentAttempted: false,
  registryMutated: false,
  databaseMutated: false,
  gatewayRuntimeActivated: false,
  resourceReleased: false,
  productionActivation: false,
} as const);

type RecognizedConcordiumNetwork =
  | {
      readonly kind: "testnet";
      readonly canonicalNetwork:
        typeof CONCORDIUM_TESTNET_CHAIN_ID;
    }
  | {
      readonly kind: "mainnet";
      readonly canonicalNetwork:
        typeof CONCORDIUM_MAINNET_CHAIN_ID;
    };

const NETWORK_IDENTIFIER_SHAPE =
  /^[a-z][a-z0-9-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/;

function networkFailure(
  reason:
    Phase6ConcordiumNetworkNormalizationFailureV1["reason"],
): Phase6ConcordiumNetworkNormalizationFailureV1 {
  return {
    ok: false,
    status: "rejected",
    reason,
    canonicalNetwork: null,
  };
}

function tokenAddressFailure(
  reason:
    Phase6ConcordiumTokenAddressNormalizationFailureV1["reason"],
): Phase6ConcordiumTokenAddressNormalizationFailureV1 {
  return {
    ok: false,
    status: "rejected",
    reason,
    canonicalNetwork: null,
    tokenAddressSuffix: null,
    canonicalTokenAddress: null,
  };
}

function identityFailure(
  reason:
    Phase6ConcordiumRegistryIdentityNormalizationFailureV1["reason"],
): Phase6ConcordiumRegistryIdentityNormalizationFailureV1 {
  return {
    ok: false,
    status: "rejected",
    reason,
    network: null,
    tokenAddress: null,
  };
}

function recognizeConcordiumNetwork(
  input: string,
): RecognizedConcordiumNetwork | null {
  switch (input) {
    case CONCORDIUM_TESTNET_CHAIN_ID:
    case PHASE6_CONCORDIUM_TESTNET_PAYMENT_ALIAS:
    case PHASE6_CONCORDIUM_TESTNET_TEMPORARY_ALIAS:
      return {
        kind: "testnet",
        canonicalNetwork:
          CONCORDIUM_TESTNET_CHAIN_ID,
      };

    case CONCORDIUM_MAINNET_CHAIN_ID:
    case PHASE6_CONCORDIUM_MAINNET_PAYMENT_ALIAS:
    case PHASE6_CONCORDIUM_MAINNET_TEMPORARY_ALIAS:
      return {
        kind: "mainnet",
        canonicalNetwork:
          CONCORDIUM_MAINNET_CHAIN_ID,
      };

    default:
      return null;
  }
}

function isStrictStringInput(
  input: unknown,
): input is string {
  return (
    typeof input === "string" &&
    input.length > 0 &&
    input === input.trim()
  );
}

function validTokenAddressSuffix(
  suffix: string,
): boolean {
  if (
    suffix.length === 0 ||
    suffix !== suffix.trim() ||
    /\s/.test(suffix)
  ) {
    return false;
  }

  const namespaceColonIndex =
    suffix.indexOf(":");

  return (
    namespaceColonIndex > 0 &&
    namespaceColonIndex < suffix.length - 1
  );
}

/**
 * Normalize an allowed Phase 6 Concordium Testnet network representation.
 *
 * Normal validation failures are returned as closed result values rather than
 * thrown exceptions.
 */
export function normalizePhase6ConcordiumTestnetNetworkV1(
  input: unknown,
): Phase6ConcordiumNetworkNormalizationResultV1 {
  if (!isStrictStringInput(input)) {
    return networkFailure(
      "invalid_network_input",
    );
  }

  if (!NETWORK_IDENTIFIER_SHAPE.test(input)) {
    return networkFailure(
      "invalid_network_input",
    );
  }

  const recognized =
    recognizeConcordiumNetwork(input);

  if (recognized === null) {
    return networkFailure(
      "unsupported_network",
    );
  }

  if (recognized.kind === "mainnet") {
    return networkFailure(
      "mainnet_not_allowed",
    );
  }

  return {
    ok: true,
    status: "normalized",
    reason: "normalized",
    canonicalNetwork:
      PHASE6_CONCORDIUM_TESTNET_CANONICAL_NETWORK,
  };
}

/**
 * Normalize the network prefix of a Phase 6 Agent Registry token address.
 *
 * The suffix after the first slash is preserved exactly. This seam does not
 * reinterpret or convert CIS-2, CIS-8004, or other asset namespaces.
 */
export function normalizePhase6ConcordiumTokenAddressV1(
  input: unknown,
): Phase6ConcordiumTokenAddressNormalizationResultV1 {
  if (!isStrictStringInput(input)) {
    return tokenAddressFailure(
      "invalid_token_address_shape",
    );
  }

  const slashIndex =
    input.indexOf("/");

  if (
    slashIndex <= 0 ||
    slashIndex >= input.length - 1
  ) {
    return tokenAddressFailure(
      "invalid_token_address_shape",
    );
  }

  const networkPrefix =
    input.slice(0, slashIndex);

  const tokenAddressSuffix =
    input.slice(slashIndex + 1);

  if (
    !validTokenAddressSuffix(
      tokenAddressSuffix,
    )
  ) {
    return tokenAddressFailure(
      "invalid_token_address_shape",
    );
  }

  const networkResult =
    normalizePhase6ConcordiumTestnetNetworkV1(
      networkPrefix,
    );

  if (!networkResult.ok) {
    return tokenAddressFailure(
      networkResult.reason ===
        "mainnet_not_allowed"
        ? "mainnet_not_allowed"
        : "invalid_token_address_network",
    );
  }

  return {
    ok: true,
    status: "normalized",
    reason: "normalized",
    canonicalNetwork:
      networkResult.canonicalNetwork,
    tokenAddressSuffix,
    canonicalTokenAddress:
      `${networkResult.canonicalNetwork}/${tokenAddressSuffix}`,
  };
}

/**
 * Normalize and cross-check the standalone registry network and the network
 * prefix embedded in its token address.
 */
export function normalizePhase6ConcordiumRegistryIdentityV1(
  input:
    Phase6ConcordiumRegistryIdentityNormalizationInputV1,
): Phase6ConcordiumRegistryIdentityNormalizationResultV1 {
  const networkResult =
    normalizePhase6ConcordiumTestnetNetworkV1(
      input.network,
    );

  if (!networkResult.ok) {
    return identityFailure(
      networkResult.reason,
    );
  }

  const tokenAddressResult =
    normalizePhase6ConcordiumTokenAddressV1(
      input.tokenAddress,
    );

  if (!tokenAddressResult.ok) {
    return identityFailure(
      tokenAddressResult.reason,
    );
  }

  if (
    networkResult.canonicalNetwork !==
    tokenAddressResult.canonicalNetwork
  ) {
    return identityFailure(
      "network_token_address_mismatch",
    );
  }

  return {
    ok: true,
    status: "normalized",
    reason: "normalized",
    network:
      networkResult.canonicalNetwork,
    tokenAddress:
      tokenAddressResult.canonicalTokenAddress,
  };
}
