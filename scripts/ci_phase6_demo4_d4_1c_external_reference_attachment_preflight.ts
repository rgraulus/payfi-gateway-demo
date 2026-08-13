/**
 * PR #313 — Demo4 D4-1C deterministic offline preflight acceptance.
 *
 * This harness proves Gate A and verifies frozen Gate B, Gate C, Gate D, and Gate E handoff integration.
 * It performs no live CIS-8004/CIS-8 read and no contract dry-run.
 */

import * as assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE,
  DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_SAFETY,
  DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_TYPE,
  DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_VERSION,
  DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH,
  DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,
  DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE,
  DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT,
  DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN,
  DEMO4_D4_1C_GATE_E_PR314_HANDOFF,
  buildDemo4D41cAttachmentCandidateV1,
  buildDemo4D41cNormalizedExternalReferenceV1,
  buildDemo4D41cOfflineAttachmentPreflightV1,
  completeDemo4D41cExternalKeyIdEqualsV1,
  serializeDemo4D41cSetExternalReferenceParameterV1,
  validateDemo4D41cAttachmentCandidateV1,
  type Demo4D41cAttachmentCandidateV1,
} from "../src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight";

const CORE_PATH =
  "src/phase6/demo4Cis8004ExternalReferenceAttachmentPreflight.ts";

function cloneCandidate():
  Demo4D41cAttachmentCandidateV1 {
  return structuredClone(
    buildDemo4D41cAttachmentCandidateV1(),
  );
}

function expectRejected(
  candidate:
    unknown,
  expectedReason:
    string,
): void {
  const result =
    validateDemo4D41cAttachmentCandidateV1(
      candidate,
    );

  assert.equal(
    result.ok,
    false,
  );

  if (
    result.ok
  ) {
    throw new Error(
      `expected_rejection:${expectedReason}`,
    );
  }

  assert.equal(
    result.reason,
    expectedReason,
  );
}

function main():
  void {
  console.log(
    "=== PR #313 D4-1C OFFLINE ATTACHMENT PREFLIGHT TEST ===",
  );

  const profile =
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE;

  assert.equal(
    profile.type,
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_TYPE,
  );

  assert.equal(
    profile.version,
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_VERSION,
  );

  assert.equal(
    profile.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );

  assert.deepEqual(
    profile.cis8004.contract,
    {
      index:
        12802,

      subindex:
        0,
    },
  );

  assert.equal(
    profile.cis8004.tokenId,
    287,
  );

  assert.equal(
    profile.cis8004.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    profile.cis8004.agentCard.uri,
    "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",
  );

  assert.equal(
    profile.cis8004.agentCard.sha256,
    "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
  );

  assert.equal(
    profile.cis8004.entrypoint,
    "setExternalReference",
  );

  assert.deepEqual(
    profile.cis8.contract,
    {
      index:
        12801,

      subindex:
        0,
    },
  );

  assert.equal(
    profile.cis8.moduleReference,
    "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",
  );

  assert.equal(
    profile.cis8.expectedStatus,
    "Active",
  );

  assert.equal(
    profile.cis8.ownerAccount,
    profile.cis8004.ownerAccount,
  );

  assert.equal(
    profile.cis8.externalKey.namespace,
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  );

  assert.equal(
    profile.cis8.externalKey.keyType,
    "ed25519",
  );

  assert.equal(
    profile.cis8.externalKey.publicKeyHex,
    "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
  );

  assert.equal(
    profile.cis8.externalKey.publicKeyHex.length,
    64,
  );

  const valid =
    buildDemo4D41cAttachmentCandidateV1();

  assert.deepEqual(
    validateDemo4D41cAttachmentCandidateV1(
      valid,
    ),
    {
      ok:
        true,
    },
  );

  const normalizedReference =
    buildDemo4D41cNormalizedExternalReferenceV1(
      valid,
    );

  assert.deepEqual(
    normalizedReference,
    {
      contract: {
        index:
          12801,

        subindex:
          0,
      },

      kind:
        "CIS-8",

      externalKey: {
        namespace:
          "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",

        keyType:
          "ed25519",

        publicKeyHex:
          "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
      },
    },
  );

  assert.equal(
    completeDemo4D41cExternalKeyIdEqualsV1(
      normalizedReference.externalKey,
      valid.cis8.externalKey,
    ),
    true,
  );

  assert.equal(
    completeDemo4D41cExternalKeyIdEqualsV1(
      normalizedReference.externalKey,
      {
        ...valid.cis8.externalKey,

        namespace:
          "solana:mainnet",
      },
    ),
    false,
  );

  const firstBytes =
    serializeDemo4D41cSetExternalReferenceParameterV1(
      valid,
    );

  const secondBytes =
    serializeDemo4D41cSetExternalReferenceParameterV1(
      valid,
    );

  assert.deepEqual(
    Array.from(
      firstBytes,
    ),
    Array.from(
      secondBytes,
    ),
  );

  assert.equal(
    firstBytes.length,
    DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH,
  );

  const preflight =
    buildDemo4D41cOfflineAttachmentPreflightV1(
      valid,
    );

  assert.equal(
    preflight.deterministicParameter.byteLength,
    117,
  );

  assert.equal(
    preflight.deterministicParameter.sha256,
    DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,
  );

  assert.equal(
    preflight.deterministicParameter.matchesProvisionalVector,
    true,
  );

  assert.equal(
    preflight.deterministicParameter.provisionalOnly,
    false,
  );

  assert.equal(
    preflight.deterministicParameter.schemaEquivalenceRequired,
    true,
  );

  assert.equal(
    preflight.deterministicParameter.schemaEquivalenceEstablished,
    true,
  );

  assert.equal(
    preflight.deterministicParameter.hex,
    "081f0100000000000001013200000000000000000000000000000027000000736f6c616e613a457457545241425a61597136694d6665594b6f75527531363656553278716131070000006564323535313920000000a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
  );

  const tokenSubstitution =
    cloneCandidate();

  tokenSubstitution.cis8004.tokenId =
    288;

  expectRejected(
    tokenSubstitution,
    "token_id_mismatch",
  );

  const cis8004ContractSubstitution =
    cloneCandidate();

  cis8004ContractSubstitution.cis8004.contract.index =
    12803;

  expectRejected(
    cis8004ContractSubstitution,
    "cis8004_contract_mismatch",
  );

  const cis8ContractSubstitution =
    cloneCandidate();

  cis8ContractSubstitution.externalReference.contract.index =
    12800;

  expectRejected(
    cis8ContractSubstitution,
    "external_reference_contract_mismatch",
  );

  const namespaceSubstitution =
    cloneCandidate();

  namespaceSubstitution.cis8.externalKey.namespace =
    "solana:mainnet";

  namespaceSubstitution.externalReference.externalKey.namespace =
    "solana:mainnet";

  expectRejected(
    namespaceSubstitution,
    "namespace_mismatch",
  );

  const keyTypeSubstitution =
    cloneCandidate();

  keyTypeSubstitution.cis8.externalKey.keyType =
    "secp256k1";

  keyTypeSubstitution.externalReference.externalKey.keyType =
    "secp256k1";

  expectRejected(
    keyTypeSubstitution,
    "unsupported_key_type",
  );

  const publicKeySubstitution =
    cloneCandidate();

  publicKeySubstitution.cis8.externalKey.publicKeyHex =
    "b4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

  publicKeySubstitution.externalReference.externalKey.publicKeyHex =
    "b4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

  expectRejected(
    publicKeySubstitution,
    "external_key_mismatch",
  );

  const ownerSubstitution =
    cloneCandidate();

  ownerSubstitution.cis8004.ownerAccount =
    "substituted-owner";

  expectRejected(
    ownerSubstitution,
    "owner_mismatch",
  );

  const malformedHex =
    cloneCandidate();

  malformedHex.cis8.externalKey.publicKeyHex =
    "zzabdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

  malformedHex.externalReference.externalKey.publicKeyHex =
    "zzabdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3";

  expectRejected(
    malformedHex,
    "invalid_public_key_hex",
  );

  const invalidLength =
    cloneCandidate();

  invalidLength.cis8.externalKey.publicKeyHex =
    "a4ab";

  invalidLength.externalReference.externalKey.publicKeyHex =
    "a4ab";

  expectRejected(
    invalidLength,
    "invalid_public_key_hex",
  );

  const wrongReferenceKind =
    cloneCandidate();

  wrongReferenceKind.externalReference.kind =
    "CIS-9";

  expectRejected(
    wrongReferenceKind,
    "unsupported_reference_kind",
  );

  const agentCardUriDrift =
    cloneCandidate();

  agentCardUriDrift.cis8004.agentCard.uri =
    "https://example.invalid/changed-agent-card.json";

  expectRejected(
    agentCardUriDrift,
    "agent_card_uri_mismatch",
  );

  const agentCardHashDrift =
    cloneCandidate();

  agentCardHashDrift.cis8004.agentCard.sha256 =
    "7ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38";

  expectRejected(
    agentCardHashDrift,
    "agent_card_hash_mismatch",
  );

  assert.deepEqual(
    preflight.safety,
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_SAFETY,
  );

  assert.equal(
    preflight.safety.offlineOnly,
    true,
  );

  assert.equal(
    preflight.safety.networkRead,
    false,
  );

  assert.equal(
    preflight.safety.privateKeyRead,
    false,
  );

  assert.equal(
    preflight.safety.walletRead,
    false,
  );

  assert.equal(
    preflight.safety.transactionConstructed,
    false,
  );

  assert.equal(
    preflight.safety.transactionSubmitted,
    false,
  );

  assert.equal(
    preflight.safety.paymentAttempted,
    false,
  );

  assert.equal(
    preflight.safety.d4_1cPerformed,
    false,
  );

  const coreSource =
    readFileSync(
      CORE_PATH,
      "utf8",
    );

  const forbiddenCorePatterns = [
    {
      label:
        "environment_access",

      pattern:
        /\bprocess\./,
    },
    {
      label:
        "filesystem_import",

      pattern:
        /from\s+["'](?:node:fs|fs)["']/,
    },
    {
      label:
        "network_import",

      pattern:
        /from\s+["']node:https?["']/,
    },
    {
      label:
        "fetch_call",

      pattern:
        /\bfetch\s*\(/,
    },
    {
      label:
        "concordium_sdk_import",

      pattern:
        /@concordium\/web-sdk/,
    },
    {
      label:
        "grpc_client",

      pattern:
        /\bConcordiumGRPCClient\b/,
    },
    {
      label:
        "invoke_contract",

      pattern:
        /\.invokeContract\s*\(/,
    },
    {
      label:
        "signing_api",

      pattern:
        /\b(?:createAccountSigner|signTransaction)\b/,
    },
    {
      label:
        "transaction_submission_api",

      pattern:
        /\b(?:sendTransaction|sendUpdateContract|createAndSendUpdateTransaction)\b/,
    },
    {
      label:
        "child_process",

      pattern:
        /from\s+["']node:child_process["']/,
    },
  ] as const;

  for (
    const rule
    of forbiddenCorePatterns
  ) {
    assert.equal(
      rule.pattern.test(
        coreSource,
      ),
      false,
      `forbidden_core_surface:${rule.label}`,
    );
  }

  console.log(
    `PROFILE_TYPE=${preflight.type}`,
  );

  console.log(
    `PROFILE_VERSION=${preflight.version}`,
  );

  console.log(
    `NETWORK=${preflight.network}`,
  );

  console.log(
    `CIS8004_CONTRACT=<${preflight.cis8004.contract.index},${preflight.cis8004.contract.subindex}>`,
  );

  console.log(
    `AGENT_TOKEN_ID=${preflight.cis8004.tokenId}`,
  );

  console.log(
    `CIS8_CONTRACT=<${preflight.cis8.contract.index},${preflight.cis8.contract.subindex}>`,
  );

  const gateB =
    DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE;

  const gateC =
    DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT;

  const gateD =
    DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN;

  const gateE =
    DEMO4_D4_1C_GATE_E_PR314_HANDOFF;

  assert.equal(
    gateB.established,
    true,
  );

  assert.equal(
    gateB.historicalD41aSnapshot.finalized,
    true,
  );

  assert.equal(
    gateB.historicalD41aSnapshot.finalizedBlockHash,
    "b8c908bbb11646be5c058f9a48a5276108d4deae65513e0b527e9352bc721510",
  );

  assert.equal(
    gateB.historicalD41aSnapshot.finalizedBlockHeight,
    46357555,
  );

  assert.equal(
    gateB.historicalD41aSnapshot.moduleReference,
    "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41",
  );

  assert.equal(
    gateB.gateBFinalizedObservation.finalized,
    true,
  );

  assert.equal(
    gateB.gateBFinalizedObservation.finalizedBlockHash,
    "b952b37cd6e91af6600a844a36f56e745a08b36e9a9db5f5529a81ece5c66d25",
  );

  assert.equal(
    gateB.gateBFinalizedObservation.finalizedBlockHeight,
    46769420,
  );

  assert.equal(
    gateB.gateBFinalizedObservation.moduleReference,
    "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  );

  assert.equal(
    gateB.moduleChangedSinceD41a,
    true,
  );

  assert.equal(
    gateB.historicalModulePreserved,
    true,
  );

  assert.equal(
    gateB.deployedSchema.byteLength,
    5700,
  );

  assert.equal(
    gateB.deployedSchema.sha256,
    "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
  );

  assert.equal(
    gateB.deployedSchema.historicalCurrentByteEquivalent,
    true,
  );

  assert.equal(
    gateB.deployedSchema.historicalSetExternalReferencePresent,
    true,
  );

  assert.equal(
    gateB.deployedSchema.observedCurrentSetExternalReferencePresent,
    true,
  );

  assert.equal(
    gateB.schemaFacingParameter.tokenIdSchemaType,
    "ByteList(U8)",
  );

  assert.equal(
    gateB.schemaFacingParameter.tokenIdU64LittleEndianHex,
    "1f01000000000000",
  );

  assert.equal(
    gateB.schemaFacingParameter.tokenIdJsonRepresentation,
    "hex-string",
  );

  assert.equal(
    gateB.schemaFacingParameter.publicKeySchemaType,
    "List(U32)",
  );

  assert.equal(
    gateB.sdkSerialization.parameterByteLength,
    DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH,
  );

  assert.equal(
    gateB.sdkSerialization.parameterSha256,
    DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,
  );

  assert.equal(
    gateB.sdkSerialization.exactManualByteEquivalence,
    true,
  );

  assert.equal(
    gateB.sdkSerialization.firstMismatchIndex,
    -1,
  );

  assert.equal(
    gateB.requiresFreshDeploymentReverificationBeforeDryRun,
    true,
  );

  assert.equal(
    gateB.contractInvoked,
    false,
  );

  assert.equal(
    gateB.contractDryRunPerformed,
    false,
  );

  assert.equal(
    gateB.privateKeyRead,
    false,
  );

  assert.equal(
    gateB.walletRead,
    false,
  );

  assert.equal(
    gateB.transactionConstructed,
    false,
  );

  assert.equal(
    gateB.transactionSubmitted,
    false,
  );

  assert.equal(
    gateB.paymentAttempted,
    false,
  );

  assert.equal(
    gateB.d4_1cPerformed,
    false,
  );

  assert.equal(
    preflight.gateB.established,
    true,
  );

  assert.equal(
    preflight.gateC,
    gateC,
  );

  assert.equal(
    gateC.established,
    true,
  );

  assert.equal(
    gateC.finalizedPublicPreflightPassed,
    true,
  );

  assert.equal(
    gateC.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );

  assert.equal(
    gateC.finalizedSnapshot.finalized,
    true,
  );

  assert.equal(
    gateC.finalizedSnapshot.finalizedBlockHash,
    "4c88b3a37560e31dad7f0d88bef428c5dcfe57bb436853f8a01d094e9889942f",
  );

  assert.equal(
    gateC.finalizedSnapshot.finalizedBlockHeight,
    46_786_332,
  );

  assert.equal(
    gateC.finalizedSnapshot.singleFinalizedSnapshotBound,
    true,
  );

  assert.equal(
    gateC.cis8004.contract.index,
    12_802,
  );

  assert.equal(
    gateC.cis8004.contract.subindex,
    0,
  );

  assert.equal(
    gateC.cis8004.moduleReference,
    "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  );

  assert.equal(
    gateC.cis8004.embeddedSchema.byteLength,
    5_700,
  );

  assert.equal(
    gateC.cis8004.embeddedSchema.sha256,
    "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
  );

  assert.equal(
    gateC.cis8004.agentOfEntrypoint,
    "agentOf",
  );

  assert.equal(
    gateC.cis8004.tokenId,
    287,
  );

  assert.equal(
    gateC.cis8004.tokenPresent,
    true,
  );

  assert.equal(
    gateC.cis8004.observedStatus,
    "Active",
  );

  assert.equal(
    gateC.cis8004.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    gateC.cis8004.ownerMatches,
    true,
  );

  assert.equal(
    gateC.cis8004.agentCardUri,
    "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",
  );

  assert.equal(
    gateC.cis8004.agentCardUriMatches,
    true,
  );

  assert.equal(
    gateC.cis8004.agentCardMetadataSha256,
    "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
  );

  assert.equal(
    gateC.cis8004.agentCardHashMatches,
    true,
  );

  assert.equal(
    gateC.cis8004.externalReferencePresent,
    false,
  );

  assert.equal(
    gateC.cis8004.revokedAtPresent,
    false,
  );

  assert.equal(
    gateC.cis8004.revocationReasonPresent,
    false,
  );

  assert.equal(
    gateC.exactExternalReferenceUniqueness.entrypoint,
    "agentByExternalReference",
  );

  assert.equal(
    gateC.exactExternalReferenceUniqueness.completeExternalReferenceCompared,
    true,
  );

  assert.equal(
    gateC.exactExternalReferenceUniqueness.alreadyAttached,
    false,
  );

  assert.equal(
    gateC.exactExternalReferenceUniqueness.unique,
    true,
  );

  assert.equal(
    gateC.cis8.contract.index,
    12_801,
  );

  assert.equal(
    gateC.cis8.contract.subindex,
    0,
  );

  assert.equal(
    gateC.cis8.moduleReference,
    "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",
  );

  assert.equal(
    gateC.cis8.embeddedSchema.byteLength,
    1_918,
  );

  assert.equal(
    gateC.cis8.embeddedSchema.sha256,
    "11312a179a14634042795bb2e075552af1d94eef18b7fc96f680d5a335e23b7e",
  );

  assert.equal(
    gateC.cis8.ownerOfKeyEntrypoint,
    "ownerOfKey",
  );

  assert.equal(
    gateC.cis8.exactExternalKey.namespace,
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  );

  assert.equal(
    gateC.cis8.exactExternalKey.keyType,
    "ed25519",
  );

  assert.equal(
    gateC.cis8.exactExternalKey.publicKeyHex,
    "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
  );

  assert.equal(
    gateC.cis8.completeExternalKeyMatch,
    true,
  );

  assert.equal(
    gateC.cis8.registered,
    true,
  );

  assert.equal(
    gateC.cis8.observedStatus,
    "Active",
  );

  assert.equal(
    gateC.cis8.ownerAccount,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    gateC.cis8.ownerMatches,
    true,
  );

  assert.equal(
    gateC.cis8.proofScheme,
    "solana-ed25519",
  );

  assert.equal(
    gateC.stateQueries.count,
    3,
  );

  assert.equal(
    gateC.stateQueries.agentOf,
    true,
  );

  assert.equal(
    gateC.stateQueries.agentByExternalReference,
    true,
  );

  assert.equal(
    gateC.stateQueries.ownerOfKey,
    true,
  );

  assert.equal(
    gateC.evidenceCaptureNetworkReadPerformed,
    true,
  );

  assert.equal(
    gateC.setExternalReferenceInvoked,
    false,
  );

  assert.equal(
    gateC.contractDryRunPerformed,
    false,
  );

  assert.equal(
    gateC.privateKeyRead,
    false,
  );

  assert.equal(
    gateC.walletRead,
    false,
  );

  assert.equal(
    gateC.transactionConstructed,
    false,
  );

  assert.equal(
    gateC.transactionSubmitted,
    false,
  );

  assert.equal(
    gateC.paymentAttempted,
    false,
  );

  assert.equal(
    gateC.d4_1cPerformed,
    false,
  );

  assert.equal(
    preflight.gateD,
    gateD,
  );

  assert.equal(
    gateD.established,
    true,
  );

  assert.equal(
    gateD.contractDryRunPassed,
    true,
  );

  assert.equal(
    gateD.authorizationConsumed,
    true,
  );

  assert.equal(
    gateD.network,
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",
  );

  assert.equal(
    gateD.finalizedSnapshot.finalized,
    true,
  );

  assert.equal(
    gateD.finalizedSnapshot.finalizedBlockHash,
    "cc5bd076c4cf091a22388c220b7dfe75fcdd8951f1854c4bbf6d366018076634",
  );

  assert.equal(
    gateD.finalizedSnapshot.finalizedBlockHeight,
    46_787_272,
  );

  assert.equal(
    gateD.cis8004.contract.index,
    12_802,
  );

  assert.equal(
    gateD.cis8004.contract.subindex,
    0,
  );

  assert.equal(
    gateD.cis8004.moduleReference,
    "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  );

  assert.equal(
    gateD.cis8004.embeddedSchema.sha256,
    "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
  );

  assert.equal(
    gateD.cis8004.receiveName,
    "CIS-8004.setExternalReference",
  );

  assert.equal(
    gateD.cis8004.schemaPresent,
    true,
  );

  assert.equal(
    gateD.parameter.byteLength,
    117,
  );

  assert.equal(
    gateD.parameter.sha256,
    DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,
  );

  assert.equal(
    gateD.parameter.manualSdkExactByteEquivalence,
    true,
  );

  assert.equal(
    gateD.invocation.invoker,
    "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",
  );

  assert.equal(
    gateD.invocation.attachedCcd,
    "0",
  );

  assert.equal(
    gateD.invocation.energySafetyCap,
    "100000",
  );

  assert.equal(
    gateD.invocation.usedEnergy,
    "2575",
  );

  assert.equal(
    gateD.invocation.returnValuePresent,
    true,
  );

  assert.equal(
    gateD.invocation.attemptCount,
    1,
  );

  assert.equal(
    gateD.invocation.succeeded,
    true,
  );

  assert.equal(
    gateD.invocation.automaticRetryAttempted,
    false,
  );

  assert.equal(
    gateD.stateVerification.readOnlyStateQueryCount,
    4,
  );

  assert.equal(
    gateD.stateVerification.preAgent287Active,
    true,
  );

  assert.equal(
    gateD.stateVerification.preAgent287OwnerMatch,
    true,
  );

  assert.equal(
    gateD.stateVerification.preAgent287ExternalReferencePresent,
    false,
  );

  assert.equal(
    gateD.stateVerification.preExactExternalReferenceAttached,
    false,
  );

  assert.equal(
    gateD.stateVerification.postAgent287Active,
    true,
  );

  assert.equal(
    gateD.stateVerification.postAgent287OwnerMatch,
    true,
  );

  assert.equal(
    gateD.stateVerification.postAgent287ExternalReferencePresent,
    false,
  );

  assert.equal(
    gateD.stateVerification.postExactExternalReferenceAttached,
    false,
  );

  assert.equal(
    gateD.stateVerification.postDryRunStateUnchanged,
    true,
  );

  assert.equal(
    gateD.evidenceCaptureNetworkAccessPerformed,
    true,
  );

  assert.equal(
    gateD.setExternalReferenceDryRunAttempted,
    true,
  );

  assert.equal(
    gateD.setExternalReferenceDryRunSucceeded,
    true,
  );

  assert.equal(
    gateD.contractInvoked,
    true,
  );

  assert.equal(
    gateD.contractDryRunPerformed,
    true,
  );

  assert.equal(
    gateD.stateMutationPerformed,
    false,
  );

  assert.equal(
    gateD.privateKeyRead,
    false,
  );

  assert.equal(
    gateD.walletRead,
    false,
  );

  assert.equal(
    gateD.signerCreated,
    false,
  );

  assert.equal(
    gateD.signingAttempted,
    false,
  );

  assert.equal(
    gateD.transactionConstructed,
    false,
  );

  assert.equal(
    gateD.transactionSubmitted,
    false,
  );

  assert.equal(
    gateD.paymentAttempted,
    false,
  );

  assert.equal(
    gateD.d4_1cPerformed,
    false,
  );

  assert.equal(
    preflight.gateE,
    gateE,
  );

  assert.equal(
    gateE.established,
    true,
  );

  assert.equal(
    gateE.status,
    "pr314_controlled_attachment_preflight_ready",
  );

  assert.equal(
    gateE.nextRequiredStep,
    "pr314_controlled_set_external_reference_requires_separate_authorization",
  );

  assert.equal(
    gateE.purpose,
    "bounded_non_authorizing_pr314_handoff",
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateA.profileType,
    preflight.type,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateA.profileVersion,
    preflight.version,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateA.deterministicParameterByteLength,
    preflight.deterministicParameter.byteLength,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateA.deterministicParameterSha256,
    preflight.deterministicParameter.sha256,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateA.schemaEquivalenceRequired,
    true,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateB.established,
    gateB.established,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateB.observedModuleReference,
    gateB.gateBFinalizedObservation.moduleReference,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateB.deployedSchemaSha256,
    gateB.deployedSchema.sha256,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateB.exactManualSdkByteEquivalence,
    gateB.sdkSerialization.exactManualByteEquivalence,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.established,
    gateC.established,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.finalizedBlockHash,
    gateC.finalizedSnapshot.finalizedBlockHash,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.finalizedBlockHeight,
    gateC.finalizedSnapshot.finalizedBlockHeight,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.exactExternalReferenceUnique,
    gateC.exactExternalReferenceUniqueness.unique,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.cis8ExactKeyActive,
    gateC.cis8.observedStatus === "Active",
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateC.stateQueryCount,
    gateC.stateQueries.count,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.established,
    gateD.established,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.finalizedBlockHash,
    gateD.finalizedSnapshot.finalizedBlockHash,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.finalizedBlockHeight,
    gateD.finalizedSnapshot.finalizedBlockHeight,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.dryRunAttemptCount,
    gateD.invocation.attemptCount,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.dryRunSucceeded,
    gateD.invocation.succeeded,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.usedEnergy,
    gateD.invocation.usedEnergy,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.postDryRunStateUnchanged,
    gateD.stateVerification.postDryRunStateUnchanged,
  );

  assert.equal(
    gateE.sourceArtifactBindings.gateD.authorizationConsumed,
    gateD.authorizationConsumed,
  );

  assert.equal(
    gateE.exactTarget.network,
    preflight.network,
  );

  assert.deepEqual(
    gateE.exactTarget.cis8004.contract,
    preflight.cis8004.contract,
  );

  assert.equal(
    gateE.exactTarget.cis8004.tokenId,
    preflight.cis8004.tokenId,
  );

  assert.equal(
    gateE.exactTarget.cis8004.ownerAccount,
    preflight.cis8004.ownerAccount,
  );

  assert.deepEqual(
    gateE.exactTarget.cis8004.agentCard,
    preflight.cis8004.agentCard,
  );

  assert.equal(
    gateE.exactTarget.cis8004.entrypoint,
    preflight.cis8004.entrypoint,
  );

  assert.deepEqual(
    gateE.exactTarget.cis8.contract,
    preflight.cis8.contract,
  );

  assert.equal(
    gateE.exactTarget.cis8.moduleReference,
    preflight.cis8.moduleReference,
  );

  assert.equal(
    gateE.exactTarget.cis8.expectedStatus,
    preflight.cis8.expectedStatus,
  );

  assert.equal(
    gateE.exactTarget.cis8.ownerAccount,
    preflight.cis8.ownerAccount,
  );

  assert.deepEqual(
    gateE.exactTarget.cis8.externalKey,
    preflight.cis8.externalKey,
  );

  assert.equal(
    gateE.exactTarget.parameter.byteLength,
    preflight.deterministicParameter.byteLength,
  );

  assert.equal(
    gateE.exactTarget.parameter.sha256,
    preflight.deterministicParameter.sha256,
  );

  assert.equal(
    gateE.futureExecutionBoundary.separateAuthorizationRequired,
    true,
  );

  assert.equal(
    gateE.futureExecutionBoundary.futureSubmissionCeiling,
    1,
  );

  assert.equal(
    gateE.futureExecutionBoundary.submissionAttemptsBeforePr314,
    0,
  );

  assert.equal(
    gateE.futureExecutionBoundary.zeroCcdRequired,
    true,
  );

  assert.equal(
    gateE.futureExecutionBoundary.automaticRetryAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.transactionExecutionAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.d4_1cAttachmentAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.privateKeyReadAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.walletReadAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.signerCreationAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.signingAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.transactionConstructionAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.transactionSubmissionAuthorized,
    false,
  );

  assert.equal(
    gateE.futureExecutionBoundary.paymentAuthorized,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.stateMutationPerformed,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.privateKeyRead,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.walletRead,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.signerCreated,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.signingAttempted,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.transactionConstructed,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.transactionSigned,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.transactionSubmitted,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.automaticRetryAttempted,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.paymentAttempted,
    false,
  );

  assert.equal(
    gateE.observedExecutionState.d4_1cPerformed,
    false,
  );

  assert.equal(
    Object.isFrozen(gateE),
    true,
  );

  assert.equal(
    Object.isFrozen(gateE.sourceArtifactBindings),
    true,
  );

  assert.equal(
    Object.isFrozen(gateE.exactTarget),
    true,
  );

  assert.equal(
    Object.isFrozen(gateE.futureExecutionBoundary),
    true,
  );

  assert.equal(
    Object.isFrozen(gateE.observedExecutionState),
    true,
  );

  console.log(
    `EXTERNAL_NAMESPACE=${preflight.cis8.externalKey.namespace}`,
  );

  console.log(
    `EXTERNAL_KEY_TYPE=${preflight.cis8.externalKey.keyType}`,
  );

  console.log(
    `PARAMETER_BYTE_LENGTH=${preflight.deterministicParameter.byteLength}`,
  );

  console.log(
    `PARAMETER_SHA256=${preflight.deterministicParameter.sha256}`,
  );

  console.log(
    `PROVISIONAL_VECTOR_MATCH=${preflight.deterministicParameter.matchesProvisionalVector}`,
  );

  console.log(
    `SCHEMA_EQUIVALENCE_ESTABLISHED=${preflight.deterministicParameter.schemaEquivalenceEstablished}`,
  );

  console.log(
    `GATE_B_HISTORICAL_MODULE_REFERENCE=${gateB.historicalD41aSnapshot.moduleReference}`,
  );

  console.log(
    `GATE_B_OBSERVED_MODULE_REFERENCE=${gateB.gateBFinalizedObservation.moduleReference}`,
  );

  console.log(
    `GATE_B_MODULE_CHANGED_SINCE_D4_1A=${gateB.moduleChangedSinceD41a}`,
  );

  console.log(
    `GATE_B_SCHEMA_BYTE_LENGTH=${gateB.deployedSchema.byteLength}`,
  );

  console.log(
    `GATE_B_SCHEMA_SHA256=${gateB.deployedSchema.sha256}`,
  );

  console.log(
    `GATE_B_HISTORICAL_CURRENT_SCHEMA_EQUAL=${gateB.deployedSchema.historicalCurrentByteEquivalent}`,
  );

  console.log(
    `GATE_B_TOKEN_ID_SCHEMA_STRING=${gateB.schemaFacingParameter.tokenIdU64LittleEndianHex}`,
  );

  console.log(
    `GATE_B_SDK_PARAMETER_BYTE_LENGTH=${gateB.sdkSerialization.parameterByteLength}`,
  );

  console.log(
    `GATE_B_SDK_PARAMETER_SHA256=${gateB.sdkSerialization.parameterSha256}`,
  );

  console.log(
    `GATE_B_EXACT_MANUAL_BYTE_EQUIVALENCE=${gateB.sdkSerialization.exactManualByteEquivalence}`,
  );

  console.log(
    `GATE_B_REVERIFY_DEPLOYMENT_BEFORE_DRY_RUN=${gateB.requiresFreshDeploymentReverificationBeforeDryRun}`,
  );

  console.log(
    `STATIC_FORBIDDEN_PATTERN_COUNT=${forbiddenCorePatterns.length}`,
  );

  console.log(
    "PRIVATE_KEY_READ=false",
  );

  console.log(
    "WALLET_READ=false",
  );

  console.log(
    `GATE_C_ESTABLISHED=${gateC.established}`,
  );

  console.log(
    `GATE_C_FINALIZED_BLOCK_HASH=${gateC.finalizedSnapshot.finalizedBlockHash}`,
  );

  console.log(
    `GATE_C_FINALIZED_BLOCK_HEIGHT=${gateC.finalizedSnapshot.finalizedBlockHeight}`,
  );

  console.log(
    `GATE_C_SINGLE_FINALIZED_SNAPSHOT_BOUND=${gateC.finalizedSnapshot.singleFinalizedSnapshotBound}`,
  );

  console.log(
    `GATE_C_CIS8004_MODULE_REFERENCE=${gateC.cis8004.moduleReference}`,
  );

  console.log(
    `GATE_C_CIS8004_SCHEMA_SHA256=${gateC.cis8004.embeddedSchema.sha256}`,
  );

  console.log(
    `GATE_C_TOKEN_287_ACTIVE=${gateC.cis8004.observedStatus === "Active"}`,
  );

  console.log(
    `GATE_C_TOKEN_287_OWNER_MATCH=${gateC.cis8004.ownerMatches}`,
  );

  console.log(
    `GATE_C_AGENT_CARD_URI_MATCH=${gateC.cis8004.agentCardUriMatches}`,
  );

  console.log(
    `GATE_C_AGENT_CARD_HASH_MATCH=${gateC.cis8004.agentCardHashMatches}`,
  );

  console.log(
    `GATE_C_EXTERNAL_REFERENCE_ABSENT=${!gateC.cis8004.externalReferencePresent}`,
  );

  console.log(
    `GATE_C_EXACT_EXTERNAL_REFERENCE_UNIQUE=${gateC.exactExternalReferenceUniqueness.unique}`,
  );

  console.log(
    `GATE_C_CIS8_MODULE_REFERENCE=${gateC.cis8.moduleReference}`,
  );

  console.log(
    `GATE_C_CIS8_SCHEMA_SHA256=${gateC.cis8.embeddedSchema.sha256}`,
  );

  console.log(
    `GATE_C_CIS8_EXACT_KEY_MATCH=${gateC.cis8.completeExternalKeyMatch}`,
  );

  console.log(
    `GATE_C_CIS8_ACTIVE=${gateC.cis8.observedStatus === "Active"}`,
  );

  console.log(
    `GATE_C_CIS8_OWNER_MATCH=${gateC.cis8.ownerMatches}`,
  );

  console.log(
    `GATE_C_STATE_QUERY_COUNT=${gateC.stateQueries.count}`,
  );

  console.log(
    `GATE_C_SET_EXTERNAL_REFERENCE_INVOKED=${gateC.setExternalReferenceInvoked}`,
  );

  console.log(
    `GATE_C_CONTRACT_DRY_RUN_PERFORMED=${gateC.contractDryRunPerformed}`,
  );

  console.log(
    `GATE_D_ESTABLISHED=${gateD.established}`,
  );

  console.log(
    `GATE_D_FINALIZED_BLOCK_HASH=${gateD.finalizedSnapshot.finalizedBlockHash}`,
  );

  console.log(
    `GATE_D_FINALIZED_BLOCK_HEIGHT=${gateD.finalizedSnapshot.finalizedBlockHeight}`,
  );

  console.log(
    `GATE_D_CIS8004_MODULE_REFERENCE=${gateD.cis8004.moduleReference}`,
  );

  console.log(
    `GATE_D_CIS8004_SCHEMA_SHA256=${gateD.cis8004.embeddedSchema.sha256}`,
  );

  console.log(
    `GATE_D_PARAMETER_BYTE_LENGTH=${gateD.parameter.byteLength}`,
  );

  console.log(
    `GATE_D_PARAMETER_SHA256=${gateD.parameter.sha256}`,
  );

  console.log(
    `GATE_D_MANUAL_SDK_EXACT_BYTE_EQUIVALENCE=${gateD.parameter.manualSdkExactByteEquivalence}`,
  );

  console.log(
    `GATE_D_ATTACHED_CCD=${gateD.invocation.attachedCcd}`,
  );

  console.log(
    `GATE_D_ENERGY_SAFETY_CAP=${gateD.invocation.energySafetyCap}`,
  );

  console.log(
    `GATE_D_USED_ENERGY=${gateD.invocation.usedEnergy}`,
  );

  console.log(
    `GATE_D_DRY_RUN_ATTEMPT_COUNT=${gateD.invocation.attemptCount}`,
  );

  console.log(
    `GATE_D_DRY_RUN_SUCCEEDED=${gateD.invocation.succeeded}`,
  );

  console.log(
    `GATE_D_READ_ONLY_STATE_QUERY_COUNT=${gateD.stateVerification.readOnlyStateQueryCount}`,
  );

  console.log(
    `GATE_D_POST_STATE_UNCHANGED=${gateD.stateVerification.postDryRunStateUnchanged}`,
  );

  console.log(
    `GATE_D_STATE_MUTATION_PERFORMED=${gateD.stateMutationPerformed}`,
  );

  console.log(
    `GATE_D_AUTHORIZATION_CONSUMED=${gateD.authorizationConsumed}`,
  );

  console.log(
    `GATE_E_ESTABLISHED=${gateE.established}`,
  );

  console.log(
    `GATE_E_STATUS=${gateE.status}`,
  );

  console.log(
    `GATE_E_NEXT_REQUIRED_STEP=${gateE.nextRequiredStep}`,
  );

  console.log(
    `GATE_E_FUTURE_SUBMISSION_CEILING=${gateE.futureExecutionBoundary.futureSubmissionCeiling}`,
  );

  console.log(
    `GATE_E_SEPARATE_AUTHORIZATION_REQUIRED=${gateE.futureExecutionBoundary.separateAuthorizationRequired}`,
  );

  console.log(
    `GATE_E_ZERO_CCD_REQUIRED=${gateE.futureExecutionBoundary.zeroCcdRequired}`,
  );

  console.log(
    `GATE_E_AUTOMATIC_RETRY_AUTHORIZED=${gateE.futureExecutionBoundary.automaticRetryAuthorized}`,
  );

  console.log(
    `GATE_E_TRANSACTION_EXECUTION_AUTHORIZED=${gateE.futureExecutionBoundary.transactionExecutionAuthorized}`,
  );

  console.log(
    `GATE_E_D4_1C_ATTACHMENT_AUTHORIZED=${gateE.futureExecutionBoundary.d4_1cAttachmentAuthorized}`,
  );

  console.log(
    `GATE_E_TRANSACTION_CONSTRUCTED=${gateE.observedExecutionState.transactionConstructed}`,
  );

  console.log(
    `GATE_E_TRANSACTION_SIGNED=${gateE.observedExecutionState.transactionSigned}`,
  );

  console.log(
    `GATE_E_TRANSACTION_SUBMITTED=${gateE.observedExecutionState.transactionSubmitted}`,
  );

  console.log(
    `GATE_E_PAYMENT_ATTEMPTED=${gateE.observedExecutionState.paymentAttempted}`,
  );

  console.log(
    `GATE_E_D4_1C_PERFORMED=${gateE.observedExecutionState.d4_1cPerformed}`,
  );

  console.log(
    "NETWORK_CALLED=false",
  );

  console.log(
    "CONTRACT_DRY_RUN_PERFORMED=false",
  );

  console.log(
    "TRANSACTION_CONSTRUCTED=false",
  );

  console.log(
    "TRANSACTION_SUBMITTED=false",
  );

  console.log(
    "PAYMENT_ATTEMPTED=false",
  );

  console.log(
    "D4_1C_PERFORMED=false",
  );

  console.log(
    "PR313_D4_1C_OFFLINE_PREFLIGHT_TESTS_PASSED=true",
  );
}

try {
  main();
} catch (
  error
) {
  console.error(
    "PR313_D4_1C_OFFLINE_PREFLIGHT_TESTS_PASSED=false",
  );

  console.error(
    error instanceof Error
      ? error.message
      : String(
          error,
        ),
  );

  process.exitCode =
    1;
}
