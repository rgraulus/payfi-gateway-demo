/**
 * PR #313 — Demo4 D4-1C external-reference attachment preflight.
 *
 * Gate A plus frozen Gate B, Gate C, Gate D, and Gate E handoff evidence:
 * - deterministic and offline;
 * - freezes the exact intended CIS-8004 -> CIS-8 relationship;
 * - serializes the exact setExternalReference parameter manually;
 * - performs no chain, wallet, signer, payment, or runtime operation.
 *
 * The 117-byte / c645... vector originated as provisional Gate A evidence.
 * Gate B subsequently proved byte-for-byte equality with serialization
 * from the deployed CIS-8004 embedded schema.
 *
 * The D4-1A historical module reference remains preserved as historical
 * evidence. A later finalized observation records the schema-preserving
 * module upgrade separately rather than rewriting that history.
 *
 * This module remains deterministic and offline. It consumes frozen,
 * sanitized Gate B, Gate C, Gate D, and Gate E handoff evidence but performs no SDK, network, wallet, signer,
 * invocation, dry-run, or transaction operation itself.
 */

import {
  createHash,
} from "node:crypto";

export const DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_TYPE =
  "xcf.phase6.demo4-d4-1c-external-reference-attachment-preflight" as const;

export const DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_VERSION =
  "1.0.0" as const;

export const DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH =
  117 as const;

export const DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256 =
  "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae" as const;

export const DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE = {
  established:
    true,

  historicalD41aSnapshot: {
    finalized:
      true,

    finalizedBlockHash:
      "b8c908bbb11646be5c058f9a48a5276108d4deae65513e0b527e9352bc721510",

    finalizedBlockHeight:
      46357555,

    moduleReference:
      "2e4fd18a59868e9dbadc03bfab505d307b3f3f5ce9c704e6284d2a626a8e3e41",
  },

  gateBFinalizedObservation: {
    finalized:
      true,

    finalizedBlockHash:
      "b952b37cd6e91af6600a844a36f56e745a08b36e9a9db5f5529a81ece5c66d25",

    finalizedBlockHeight:
      46769420,

    moduleReference:
      "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  },

  moduleChangedSinceD41a:
    true,

  historicalModulePreserved:
    true,

  deployedSchema: {
    byteLength:
      5700,

    sha256:
      "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",

    historicalCurrentByteEquivalent:
      true,

    historicalSetExternalReferencePresent:
      true,

    observedCurrentSetExternalReferencePresent:
      true,
  },

  schemaFacingParameter: {
    tokenIdSchemaType:
      "ByteList(U8)",

    tokenIdU64LittleEndianHex:
      "1f01000000000000",

    tokenIdJsonRepresentation:
      "hex-string",

    publicKeySchemaType:
      "List(U32)",
  },

  sdkSerialization: {
    parameterByteLength:
      117,

    parameterSha256:
      "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",

    exactManualByteEquivalence:
      true,

    firstMismatchIndex:
      -1,
  },

  requiresFreshDeploymentReverificationBeforeDryRun:
    true,

  contractInvoked:
    false,

  contractDryRunPerformed:
    false,

  privateKeyRead:
    false,

  walletRead:
    false,

  transactionConstructed:
    false,

  transactionSubmitted:
    false,

  paymentAttempted:
    false,

  d4_1cPerformed:
    false,
} as const;

export const DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT =
  Object.freeze({
    established:
      true,

    finalizedPublicPreflightPassed:
      true,

    network:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    finalizedSnapshot:
      Object.freeze({
        finalized:
          true,

        finalizedBlockHash:
          "4c88b3a37560e31dad7f0d88bef428c5dcfe57bb436853f8a01d094e9889942f",

        finalizedBlockHeight:
          46_786_332,

        singleFinalizedSnapshotBound:
          true,
      }),

    cis8004:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              12_802,

            subindex:
              0,
          }),

        moduleReference:
          "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

        embeddedSchema:
          Object.freeze({
            byteLength:
              5_700,

            sha256:
              "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
          }),

        agentOfEntrypoint:
          "agentOf",

        tokenId:
          287,

        tokenPresent:
          true,

        expectedStatus:
          "Active",

        observedStatus:
          "Active",

        ownerAccount:
          "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

        ownerMatches:
          true,

        agentCardUri:
          "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

        agentCardUriMatches:
          true,

        agentCardMetadataSha256:
          "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",

        agentCardHashMatches:
          true,

        externalReferencePresent:
          false,

        revokedAtPresent:
          false,

        revocationReasonPresent:
          false,
      }),

    exactExternalReferenceUniqueness:
      Object.freeze({
        entrypoint:
          "agentByExternalReference",

        completeExternalReferenceCompared:
          true,

        alreadyAttached:
          false,

        unique:
          true,
      }),

    cis8:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              12_801,

            subindex:
              0,
          }),

        moduleReference:
          "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",

        embeddedSchema:
          Object.freeze({
            byteLength:
              1_918,

            sha256:
              "11312a179a14634042795bb2e075552af1d94eef18b7fc96f680d5a335e23b7e",
          }),

        ownerOfKeyEntrypoint:
          "ownerOfKey",

        exactExternalKey:
          Object.freeze({
            namespace:
              "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",

            keyType:
              "ed25519",

            publicKeyHex:
              "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
          }),

        completeExternalKeyMatch:
          true,

        registered:
          true,

        expectedStatus:
          "Active",

        observedStatus:
          "Active",

        ownerAccount:
          "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

        ownerMatches:
          true,

        proofScheme:
          "solana-ed25519",
      }),

    stateQueries:
      Object.freeze({
        count:
          3,

        agentOf:
          true,

        agentByExternalReference:
          true,

        ownerOfKey:
          true,
      }),

    evidenceCaptureNetworkReadPerformed:
      true,

    setExternalReferenceInvoked:
      false,

    contractDryRunPerformed:
      false,

    privateKeyRead:
      false,

    walletRead:
      false,

    transactionConstructed:
      false,

    transactionSubmitted:
      false,

    paymentAttempted:
      false,

    d4_1cPerformed:
      false,
  });

export const DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN =
  Object.freeze({
    established:
      true,

    contractDryRunPassed:
      true,

    authorizationConsumed:
      true,

    network:
      "ccd:4221332d34e1694168c2a0c0b3fd0f27",

    finalizedSnapshot:
      Object.freeze({
        finalized:
          true,

        finalizedBlockHash:
          "cc5bd076c4cf091a22388c220b7dfe75fcdd8951f1854c4bbf6d366018076634",

        finalizedBlockHeight:
          46_787_272,
      }),

    cis8004:
      Object.freeze({
        contract:
          Object.freeze({
            index:
              12_802,

            subindex:
              0,
          }),

        moduleReference:
          "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

        embeddedSchema:
          Object.freeze({
            sha256:
              "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",
          }),

        receiveName:
          "CIS-8004.setExternalReference",

        schemaPresent:
          true,
      }),

    parameter:
      Object.freeze({
        byteLength:
          117,

        sha256:
          "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",

        manualSdkExactByteEquivalence:
          true,
      }),

    invocation:
      Object.freeze({
        invoker:
          "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

        attachedCcd:
          "0",

        energySafetyCap:
          "100000",

        usedEnergy:
          "2575",

        returnValuePresent:
          true,

        attemptCount:
          1,

        succeeded:
          true,

        automaticRetryAttempted:
          false,
      }),

    stateVerification:
      Object.freeze({
        readOnlyStateQueryCount:
          4,

        preAgent287Active:
          true,

        preAgent287OwnerMatch:
          true,

        preAgent287ExternalReferencePresent:
          false,

        preExactExternalReferenceAttached:
          false,

        postAgent287Active:
          true,

        postAgent287OwnerMatch:
          true,

        postAgent287ExternalReferencePresent:
          false,

        postExactExternalReferenceAttached:
          false,

        postDryRunStateUnchanged:
          true,
      }),

    evidenceCaptureNetworkAccessPerformed:
      true,

    setExternalReferenceDryRunAttempted:
      true,

    setExternalReferenceDryRunSucceeded:
      true,

    contractInvoked:
      true,

    contractDryRunPerformed:
      true,

    stateMutationPerformed:
      false,

    privateKeyRead:
      false,

    walletRead:
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

    d4_1cPerformed:
      false,
  });

export const DEMO4_D4_1C_GATE_E_PR314_HANDOFF =
  Object.freeze({
    established:
      true,

    status:
      "pr314_controlled_attachment_preflight_ready",

    nextRequiredStep:
      "pr314_controlled_set_external_reference_requires_separate_authorization",

    purpose:
      "bounded_non_authorizing_pr314_handoff",

    sourceArtifactBindings:
      Object.freeze({
        gateA:
          Object.freeze({
            profileType:
              "xcf.phase6.demo4-d4-1c-external-reference-attachment-preflight",

            profileVersion:
              "1.0.0",

            deterministicParameterByteLength:
              117,

            deterministicParameterSha256:
              "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",

            schemaEquivalenceRequired:
              true,
          }),

        gateB:
          Object.freeze({
            established:
              true,

            observedModuleReference:
              "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

            deployedSchemaSha256:
              "cdef154fde46cbe9ada601135955c5998deeca4b22d9258d25840b745b79374d",

            exactManualSdkByteEquivalence:
              true,
          }),

        gateC:
          Object.freeze({
            established:
              true,

            finalizedBlockHash:
              "4c88b3a37560e31dad7f0d88bef428c5dcfe57bb436853f8a01d094e9889942f",

            finalizedBlockHeight:
              46_786_332,

            exactExternalReferenceUnique:
              true,

            cis8ExactKeyActive:
              true,

            stateQueryCount:
              3,
          }),

        gateD:
          Object.freeze({
            established:
              true,

            finalizedBlockHash:
              "cc5bd076c4cf091a22388c220b7dfe75fcdd8951f1854c4bbf6d366018076634",

            finalizedBlockHeight:
              46_787_272,

            dryRunAttemptCount:
              1,

            dryRunSucceeded:
              true,

            usedEnergy:
              "2575",

            postDryRunStateUnchanged:
              true,

            authorizationConsumed:
              true,
          }),
      }),

    exactTarget:
      Object.freeze({
        network:
          "ccd:4221332d34e1694168c2a0c0b3fd0f27",

        cis8004:
          Object.freeze({
            contract:
              Object.freeze({
                index:
                  12_802,

                subindex:
                  0,
              }),

            tokenId:
              287,

            ownerAccount:
              "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

            agentCard:
              Object.freeze({
                uri:
                  "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

                sha256:
                  "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
              }),

            entrypoint:
              "setExternalReference",
          }),

        cis8:
          Object.freeze({
            contract:
              Object.freeze({
                index:
                  12_801,

                subindex:
                  0,
              }),

            moduleReference:
              "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",

            expectedStatus:
              "Active",

            ownerAccount:
              "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

            externalKey:
              Object.freeze({
                namespace:
                  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",

                keyType:
                  "ed25519",

                publicKeyHex:
                  "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
              }),
          }),

        parameter:
          Object.freeze({
            byteLength:
              117,

            sha256:
              "c645fa2739411f16b557f2edeb8059c596715960e66f284d529cbea98d8448ae",
          }),
      }),

    futureExecutionBoundary:
      Object.freeze({
        separateAuthorizationRequired:
          true,

        futureSubmissionCeiling:
          1,

        submissionAttemptsBeforePr314:
          0,

        zeroCcdRequired:
          true,

        automaticRetryAuthorized:
          false,

        transactionExecutionAuthorized:
          false,

        d4_1cAttachmentAuthorized:
          false,

        privateKeyReadAuthorized:
          false,

        walletReadAuthorized:
          false,

        signerCreationAuthorized:
          false,

        signingAuthorized:
          false,

        transactionConstructionAuthorized:
          false,

        transactionSubmissionAuthorized:
          false,

        paymentAuthorized:
          false,
      }),

    observedExecutionState:
      Object.freeze({
        stateMutationPerformed:
          false,

        privateKeyRead:
          false,

        walletRead:
          false,

        signerCreated:
          false,

        signingAttempted:
          false,

        transactionConstructed:
          false,

        transactionSigned:
          false,

        transactionSubmitted:
          false,

        automaticRetryAttempted:
          false,

        paymentAttempted:
          false,

        d4_1cPerformed:
          false,
      }),
  });

export const DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE = {
  type:
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_TYPE,

  version:
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_VERSION,

  network:
    "ccd:4221332d34e1694168c2a0c0b3fd0f27",

  cis8004: {
    contractName:
      "CIS-8004",

    contract: {
      index:
        12802,

      subindex:
        0,
    },

    tokenId:
      287,

    ownerAccount:
      "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

    agentCard: {
      uri:
        "https://rgraulus.github.io/xcf-demo4-agent-card/agent-card.json",

      sha256:
        "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",
    },

    entrypoint:
      "setExternalReference",
  },

  cis8: {
    contractName:
      "CIS-8",

    contract: {
      index:
        12801,

      subindex:
        0,
    },

    moduleReference:
      "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",

    expectedStatus:
      "Active",

    ownerAccount:
      "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

    externalKey: {
      namespace:
        "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",

      keyType:
        "ed25519",

      publicKeyHex:
        "a4abdcb4dc5d6d81bab06361ab860f819d820f6cadc33e8641cd6733f3baa5d3",
    },
  },

  externalReference: {
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
} as const;

export const DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_SAFETY = {
  offlineOnly:
    true,

  environmentRead:
    false,

  filesystemRead:
    false,

  filesystemWrite:
    false,

  networkRead:
    false,

  sdkSerializationPerformed:
    false,

  schemaEquivalenceEstablished:
    true,

  finalizedPublicPreflightPerformed:
    false,

  contractDryRunPerformed:
    false,

  privateKeyRead:
    false,

  walletRead:
    false,

  signerCreated:
    false,

  signingPerformed:
    false,

  transactionConstructed:
    false,

  transactionSubmitted:
    false,

  paymentAttempted:
    false,

  settlementAttempted:
    false,

  receiptRequested:
    false,

  protectedResourceReleased:
    false,

  d4_1cPerformed:
    false,
} as const;

export type Demo4D41cContractCoordinateV1 = {
  readonly index:
    number;

  readonly subindex:
    number;
};

export type Demo4D41cExternalKeyIdV1 = {
  readonly namespace:
    string;

  readonly keyType:
    string;

  readonly publicKeyHex:
    string;
};

export type Demo4D41cExternalReferenceV1 = {
  readonly contract:
    Demo4D41cContractCoordinateV1;

  readonly kind:
    string;

  readonly externalKey:
    Demo4D41cExternalKeyIdV1;
};

export type Demo4D41cAttachmentCandidateV1 = {
  readonly type:
    string;

  readonly version:
    string;

  readonly network:
    string;

  readonly cis8004: {
    readonly contractName:
      string;

    readonly contract:
      Demo4D41cContractCoordinateV1;

    readonly tokenId:
      number;

    readonly ownerAccount:
      string;

    readonly agentCard: {
      readonly uri:
        string;

      readonly sha256:
        string;
    };

    readonly entrypoint:
      string;
  };

  readonly cis8: {
    readonly contractName:
      string;

    readonly contract:
      Demo4D41cContractCoordinateV1;

    readonly moduleReference:
      string;

    readonly expectedStatus:
      string;

    readonly ownerAccount:
      string;

    readonly externalKey:
      Demo4D41cExternalKeyIdV1;
  };

  readonly externalReference:
    Demo4D41cExternalReferenceV1;
};

export type Demo4D41cAttachmentValidationResultV1 =
  | {
      readonly ok:
        true;
    }
  | {
      readonly ok:
        false;

      readonly reason:
        string;
    };

type UnknownRecord =
  Record<string, unknown>;

function record(
  value:
    unknown,
): UnknownRecord | null {
  if (
    value === null ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as UnknownRecord;
}

function failure(
  reason:
    string,
): Demo4D41cAttachmentValidationResultV1 {
  return {
    ok:
      false,

    reason,
  };
}

function validCoordinate(
  value:
    unknown,
): value is Demo4D41cContractCoordinateV1 {
  const parsed =
    record(
      value,
    );

  return (
    parsed !== null &&
    typeof parsed.index ===
      "number" &&
    Number.isSafeInteger(
      parsed.index,
    ) &&
    parsed.index >=
      0 &&
    typeof parsed.subindex ===
      "number" &&
    Number.isSafeInteger(
      parsed.subindex,
    ) &&
    parsed.subindex >=
      0
  );
}

function coordinateEquals(
  left:
    Demo4D41cContractCoordinateV1,
  right:
    Demo4D41cContractCoordinateV1,
): boolean {
  return (
    left.index ===
      right.index &&
    left.subindex ===
      right.subindex
  );
}

function validLowerHex32(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{64}$/.test(
      value,
    )
  );
}

export function completeDemo4D41cExternalKeyIdEqualsV1(
  left:
    Demo4D41cExternalKeyIdV1,
  right:
    Demo4D41cExternalKeyIdV1,
): boolean {
  return (
    left.namespace ===
      right.namespace &&
    left.keyType ===
      right.keyType &&
    left.publicKeyHex ===
      right.publicKeyHex
  );
}

export function buildDemo4D41cAttachmentCandidateV1():
  Demo4D41cAttachmentCandidateV1 {
  const profile =
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE;

  return {
    type:
      profile.type,

    version:
      profile.version,

    network:
      profile.network,

    cis8004: {
      contractName:
        profile.cis8004.contractName,

      contract: {
        index:
          profile.cis8004.contract.index,

        subindex:
          profile.cis8004.contract.subindex,
      },

      tokenId:
        profile.cis8004.tokenId,

      ownerAccount:
        profile.cis8004.ownerAccount,

      agentCard: {
        uri:
          profile.cis8004.agentCard.uri,

        sha256:
          profile.cis8004.agentCard.sha256,
      },

      entrypoint:
        profile.cis8004.entrypoint,
    },

    cis8: {
      contractName:
        profile.cis8.contractName,

      contract: {
        index:
          profile.cis8.contract.index,

        subindex:
          profile.cis8.contract.subindex,
      },

      moduleReference:
        profile.cis8.moduleReference,

      expectedStatus:
        profile.cis8.expectedStatus,

      ownerAccount:
        profile.cis8.ownerAccount,

      externalKey: {
        namespace:
          profile.cis8.externalKey.namespace,

        keyType:
          profile.cis8.externalKey.keyType,

        publicKeyHex:
          profile.cis8.externalKey.publicKeyHex,
      },
    },

    externalReference: {
      contract: {
        index:
          profile.externalReference.contract.index,

        subindex:
          profile.externalReference.contract.subindex,
      },

      kind:
        profile.externalReference.kind,

      externalKey: {
        namespace:
          profile.externalReference.externalKey.namespace,

        keyType:
          profile.externalReference.externalKey.keyType,

        publicKeyHex:
          profile.externalReference.externalKey.publicKeyHex,
      },
    },
  };
}

export function validateDemo4D41cAttachmentCandidateV1(
  input:
    unknown,
): Demo4D41cAttachmentValidationResultV1 {
  const expected =
    DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_PROFILE;

  const root =
    record(
      input,
    );

  if (
    root ===
      null
  ) {
    return failure(
      "invalid_profile_shape",
    );
  }

  if (
    root.type !==
      expected.type ||
    root.version !==
      expected.version
  ) {
    return failure(
      "profile_identity_mismatch",
    );
  }

  if (
    root.network !==
      expected.network
  ) {
    return failure(
      "network_mismatch",
    );
  }

  const cis8004 =
    record(
      root.cis8004,
    );

  const cis8 =
    record(
      root.cis8,
    );

  const externalReference =
    record(
      root.externalReference,
    );

  if (
    cis8004 ===
      null ||
    cis8 ===
      null ||
    externalReference ===
      null
  ) {
    return failure(
      "invalid_profile_shape",
    );
  }

  if (
    cis8004.contractName !==
      expected.cis8004.contractName ||
    !validCoordinate(
      cis8004.contract,
    ) ||
    !coordinateEquals(
      cis8004.contract,
      expected.cis8004.contract,
    )
  ) {
    return failure(
      "cis8004_contract_mismatch",
    );
  }

  if (
    cis8004.tokenId !==
      expected.cis8004.tokenId
  ) {
    return failure(
      "token_id_mismatch",
    );
  }

  if (
    cis8004.ownerAccount !==
      expected.cis8004.ownerAccount
  ) {
    return failure(
      "owner_mismatch",
    );
  }

  const agentCard =
    record(
      cis8004.agentCard,
    );

  if (
    agentCard ===
      null
  ) {
    return failure(
      "invalid_agent_card_shape",
    );
  }

  if (
    agentCard.uri !==
      expected.cis8004.agentCard.uri
  ) {
    return failure(
      "agent_card_uri_mismatch",
    );
  }

  if (
    !validLowerHex32(
      agentCard.sha256,
    )
  ) {
    return failure(
      "invalid_agent_card_hash",
    );
  }

  if (
    agentCard.sha256 !==
      expected.cis8004.agentCard.sha256
  ) {
    return failure(
      "agent_card_hash_mismatch",
    );
  }

  if (
    cis8004.entrypoint !==
      expected.cis8004.entrypoint
  ) {
    return failure(
      "entrypoint_mismatch",
    );
  }

  if (
    cis8.contractName !==
      expected.cis8.contractName ||
    !validCoordinate(
      cis8.contract,
    ) ||
    !coordinateEquals(
      cis8.contract,
      expected.cis8.contract,
    ) ||
    cis8.moduleReference !==
      expected.cis8.moduleReference
  ) {
    return failure(
      "cis8_registry_mismatch",
    );
  }

  if (
    cis8.expectedStatus !==
      expected.cis8.expectedStatus
  ) {
    return failure(
      "cis8_status_expectation_mismatch",
    );
  }

  if (
    cis8.ownerAccount !==
      expected.cis8.ownerAccount ||
    cis8.ownerAccount !==
      cis8004.ownerAccount
  ) {
    return failure(
      "owner_mismatch",
    );
  }

  if (
    !validCoordinate(
      externalReference.contract,
    ) ||
    !coordinateEquals(
      externalReference.contract,
      expected.externalReference.contract,
    ) ||
    !coordinateEquals(
      externalReference.contract,
      cis8.contract as Demo4D41cContractCoordinateV1,
    )
  ) {
    return failure(
      "external_reference_contract_mismatch",
    );
  }

  if (
    externalReference.kind !==
      expected.externalReference.kind
  ) {
    return failure(
      "unsupported_reference_kind",
    );
  }

  const cis8ExternalKey =
    record(
      cis8.externalKey,
    );

  const referenceExternalKey =
    record(
      externalReference.externalKey,
    );

  if (
    cis8ExternalKey ===
      null ||
    referenceExternalKey ===
      null ||
    typeof cis8ExternalKey.namespace !==
      "string" ||
    typeof cis8ExternalKey.keyType !==
      "string" ||
    typeof referenceExternalKey.namespace !==
      "string" ||
    typeof referenceExternalKey.keyType !==
      "string"
  ) {
    return failure(
      "invalid_external_key_shape",
    );
  }

  if (
    cis8ExternalKey.namespace !==
      expected.cis8.externalKey.namespace ||
    referenceExternalKey.namespace !==
      expected.externalReference.externalKey.namespace
  ) {
    return failure(
      "namespace_mismatch",
    );
  }

  if (
    cis8ExternalKey.keyType !==
      expected.cis8.externalKey.keyType ||
    referenceExternalKey.keyType !==
      expected.externalReference.externalKey.keyType
  ) {
    return failure(
      "unsupported_key_type",
    );
  }

  if (
    !validLowerHex32(
      cis8ExternalKey.publicKeyHex,
    ) ||
    !validLowerHex32(
      referenceExternalKey.publicKeyHex,
    )
  ) {
    return failure(
      "invalid_public_key_hex",
    );
  }

  const expectedKey:
    Demo4D41cExternalKeyIdV1 = {
      namespace:
        expected.cis8.externalKey.namespace,

      keyType:
        expected.cis8.externalKey.keyType,

      publicKeyHex:
        expected.cis8.externalKey.publicKeyHex,
    };

  const cis8Key:
    Demo4D41cExternalKeyIdV1 = {
      namespace:
        cis8ExternalKey.namespace,

      keyType:
        cis8ExternalKey.keyType,

      publicKeyHex:
        cis8ExternalKey.publicKeyHex,
    };

  const referenceKey:
    Demo4D41cExternalKeyIdV1 = {
      namespace:
        referenceExternalKey.namespace,

      keyType:
        referenceExternalKey.keyType,

      publicKeyHex:
        referenceExternalKey.publicKeyHex,
    };

  if (
    !completeDemo4D41cExternalKeyIdEqualsV1(
      cis8Key,
      expectedKey,
    ) ||
    !completeDemo4D41cExternalKeyIdEqualsV1(
      referenceKey,
      expectedKey,
    ) ||
    !completeDemo4D41cExternalKeyIdEqualsV1(
      cis8Key,
      referenceKey,
    )
  ) {
    return failure(
      "external_key_mismatch",
    );
  }

  return {
    ok:
      true,
  };
}

function assertValidCandidate(
  input:
    unknown,
): asserts input is Demo4D41cAttachmentCandidateV1 {
  const validation =
    validateDemo4D41cAttachmentCandidateV1(
      input,
    );

  if (
    !validation.ok
  ) {
    throw new Error(
      validation.reason,
    );
  }
}

function encodeU64Le(
  value:
    number,
): Buffer {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value <
      0
  ) {
    throw new Error(
      "invalid_u64_value",
    );
  }

  const output =
    Buffer.alloc(
      8,
    );

  output.writeBigUInt64LE(
    BigInt(
      value,
    ),
    0,
  );

  return output;
}

function encodeU32Le(
  value:
    number,
): Buffer {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value <
      0 ||
    value >
      0xffffffff
  ) {
    throw new Error(
      "invalid_u32_value",
    );
  }

  const output =
    Buffer.alloc(
      4,
    );

  output.writeUInt32LE(
    value,
    0,
  );

  return output;
}

function encodeLengthPrefixedUtf8(
  value:
    string,
): Buffer {
  const bytes =
    Buffer.from(
      value,
      "utf8",
    );

  return Buffer.concat([
    encodeU32Le(
      bytes.length,
    ),
    bytes,
  ]);
}

function encodeLengthPrefixedBytes(
  bytes:
    Buffer,
): Buffer {
  return Buffer.concat([
    encodeU32Le(
      bytes.length,
    ),
    bytes,
  ]);
}

function strictPublicKeyBytes(
  publicKeyHex:
    string,
): Buffer {
  if (
    !validLowerHex32(
      publicKeyHex,
    )
  ) {
    throw new Error(
      "invalid_public_key_hex",
    );
  }

  return Buffer.from(
    publicKeyHex,
    "hex",
  );
}

function sha256Hex(
  value:
    Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}

export function buildDemo4D41cNormalizedExternalReferenceV1(
  input:
    unknown =
      buildDemo4D41cAttachmentCandidateV1(),
): Demo4D41cExternalReferenceV1 {
  assertValidCandidate(
    input,
  );

  return {
    contract: {
      index:
        input.externalReference.contract.index,

      subindex:
        input.externalReference.contract.subindex,
    },

    kind:
      input.externalReference.kind,

    externalKey: {
      namespace:
        input.externalReference.externalKey.namespace,

      keyType:
        input.externalReference.externalKey.keyType,

      publicKeyHex:
        input.externalReference.externalKey.publicKeyHex,
    },
  };
}

export function serializeDemo4D41cSetExternalReferenceParameterV1(
  input:
    unknown =
      buildDemo4D41cAttachmentCandidateV1(),
): Uint8Array {
  assertValidCandidate(
    input,
  );

  const externalKey =
    input.externalReference.externalKey;

  const publicKey =
    strictPublicKeyBytes(
      externalKey.publicKeyHex,
    );

  return Uint8Array.from(
    Buffer.concat([
      // AgentTokenId: CIS-2 TokenIdU64 wire form.
      Buffer.from([
        8,
      ]),
      encodeU64Le(
        input.cis8004.tokenId,
      ),

      // OptionalExtRef::Some.
      Buffer.from([
        1,
      ]),

      // Concordium ContractAddress.
      encodeU64Le(
        input.externalReference.contract.index,
      ),
      encodeU64Le(
        input.externalReference.contract.subindex,
      ),

      // ExternalRefKind::Cis8.
      Buffer.from([
        0,
      ]),

      // CIS-8 ExternalKeyId.
      encodeLengthPrefixedUtf8(
        externalKey.namespace,
      ),
      encodeLengthPrefixedUtf8(
        externalKey.keyType,
      ),
      encodeLengthPrefixedBytes(
        publicKey,
      ),
    ]),
  );
}

export function buildDemo4D41cOfflineAttachmentPreflightV1(
  input:
    unknown =
      buildDemo4D41cAttachmentCandidateV1(),
) {
  assertValidCandidate(
    input,
  );

  const externalReference =
    buildDemo4D41cNormalizedExternalReferenceV1(
      input,
    );

  const deterministicBytes =
    serializeDemo4D41cSetExternalReferenceParameterV1(
      input,
    );

  const deterministicSha256 =
    sha256Hex(
      deterministicBytes,
    );

  return {
    type:
      DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_TYPE,

    version:
      DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_VERSION,

    status:
      "offline_profile_valid" as const,

    network:
      input.network,

    cis8004: {
      contract:
        input.cis8004.contract,

      tokenId:
        input.cis8004.tokenId,

      ownerAccount:
        input.cis8004.ownerAccount,

      agentCard:
        input.cis8004.agentCard,

      entrypoint:
        input.cis8004.entrypoint,
    },

    cis8: {
      contract:
        input.cis8.contract,

      moduleReference:
        input.cis8.moduleReference,

      expectedStatus:
        input.cis8.expectedStatus,

      ownerAccount:
        input.cis8.ownerAccount,

      externalKey:
        input.cis8.externalKey,
    },

    externalReference,

    deterministicParameter: {
      byteLength:
        deterministicBytes.length,

      sha256:
        deterministicSha256,

      hex:
        Buffer.from(
          deterministicBytes,
        ).toString(
          "hex",
        ),

      provisionalExpectedByteLength:
        DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH,

      provisionalExpectedSha256:
        DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,

      matchesProvisionalVector:
        deterministicBytes.length ===
          DEMO4_D4_1C_PROVISIONAL_PARAMETER_BYTE_LENGTH &&
        deterministicSha256 ===
          DEMO4_D4_1C_PROVISIONAL_PARAMETER_SHA256,

      provisionalOnly:
        false,

      schemaEquivalenceRequired:
        true,

      schemaEquivalenceEstablished:
        DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE
          .established,
    },

    gateB:
      DEMO4_D4_1C_GATE_B_DEPLOYED_SCHEMA_EQUIVALENCE,

    gateC:
      DEMO4_D4_1C_GATE_C_FINALIZED_PUBLIC_PREFLIGHT,

    gateD:
      DEMO4_D4_1C_GATE_D_CONTRACT_DRY_RUN,

    gateE:
      DEMO4_D4_1C_GATE_E_PR314_HANDOFF,

    safety:
      DEMO4_D4_1C_EXTERNAL_REFERENCE_ATTACHMENT_PREFLIGHT_SAFETY,
  };
}
