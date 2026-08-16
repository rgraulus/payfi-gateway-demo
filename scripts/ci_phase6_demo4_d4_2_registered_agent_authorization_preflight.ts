/**
 * PR #316 — deterministic/offline contract coverage for the Phase 6
 * Demo4 D4-2 registered-agent authorization preflight.
 *
 * No network, database, wallet, signer, contract, transaction, payment,
 * receipt, or protected-resource operation is performed.
 */

import assert from "node:assert/strict";

import {
  DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE,
  DEMO4_D4_2_SUCCESS_REASON,
  evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1,
  type Demo4D42RegisteredAgentAuthorizationPreflightInputV1,
} from "../src/phase6/demo4RegisteredAgentAuthorizationPreflight";

import {
  DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP,
  DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY,
  DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON,
  DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH,
  DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH,
  DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY,
  DEMO4_D4_2_CAPABILITY_RULES,
  buildDemo4D42LiveTransportBundleV1,
  demo4D42RunnerDispatchStateForTestV1,
  evaluateDemo4D42GatewayProxyPreclaimContractV1,
  type Demo4D42GatewayProxyPreclaimContractInputV1,
} from "./demo_phase6_demo4_d4_2_registered_agent_authorization_preflight";

import {
  ConcordiumGrpcCis8004ReadTransportV1,
} from "../src/phase6/concordiumCis8004RegistryPlugin";

import {
  ConcordiumGrpcCis8ReadTransportV1,
} from "../src/phase6/agentRegistryIdentityKeyBinding";

import {
  HttpsAgentCardFetchTransportV1,
} from "../src/phase6/agentRegistryCardCapabilityFreshness";

function baseInput():
Demo4D42RegisteredAgentAuthorizationPreflightInputV1 {
  return {
    liveProfile: {
      ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE,

      cis8004: {
        ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
          .cis8004,

        contract: {
          ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
            .cis8004
            .contract,
        },
      },

      cis8: {
        ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
          .cis8,

        contract: {
          ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
            .cis8
            .contract,
        },

        externalKey: {
          ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
            .cis8
            .externalKey,
        },
      },

      agentCard: {
        ...DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
          .agentCard,
      },
    },

    lifecycle: {
      ok:
        true,

      status:
        "accepted",

      reason:
        "lifecycle_ready",

      mode:
        "controlled_test_only",

      lifecycleEvaluated:
        true,

      lifecycleContractValidated:
        true,

      lifecycleContractMatched:
        true,

      cryptographicDelegationVerified:
        true,

      cryptographicBindingVerified:
        true,

      validityEvaluatedAgainstClock:
        true,

      credentialCurrentlyValid:
        true,

      nowSec:
        1_800_000_000,

      notBeforeSec:
        1_799_999_000,

      expiresAtSec:
        1_800_001_000,

      delegationId:
        "delegation-demo4-d4-2",

      credentialHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

      revocationId:
        "revocation-demo4-d4-2",

      buyerKeyVersion:
        1,

      agentKeyVersion:
        1,

      maxUses:
        1,

      lifecycleContract: {
        delegationId:
          "delegation-demo4-d4-2",

        credentialHash:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

        revocationId:
          "revocation-demo4-d4-2",

        buyerKeyVersion:
          1,

        agentKeyVersion:
          1,

        maxUses:
          1,
      },

      revocationChecked:
        false,

      delegationRevoked:
        false,

      boundedUseChecked:
        false,

      boundedUseConsumed:
        false,

      currentAuthorizationEstablished:
        false,

      buyerVerificationKeyTrustEstablished:
        false,

      buyerIdentityAuthenticated:
        false,

      buyerKeyOwnershipEstablished:
        false,

      agentIdentityAuthenticated:
        false,

      agentKeyTrustEstablished:
        false,

      gatewayCalled:
        false,

      crpCalled:
        false,

      paymentAttempted:
        false,

      receiptJwsPrinted:
        false,

      paymentResponsePrinted:
        false,

      protectedResourceReleased:
        false,

      agentRegistryLookupAttempted:
        false,

      productionActivation:
        false,
    },

    revocation: {
      ok:
        true,

      reason:
        "not_revoked",

      revocationChecked:
        true,

      delegationRevoked:
        false,

      lifecycleContractMatched:
        true,

      revocationId:
        "revocation-demo4-d4-2",

      delegationId:
        "delegation-demo4-d4-2",

      credentialHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

      revokedAt:
        null,

      revocationReasonCode:
        null,
    },

    registeredAgentAuthorization: {
      type:
        "xcf.agent-registry.conditional-gating-authorization",

      version:
        "1.0.0",

      mode:
        "controlled_gateway_composition",

      testOnly:
        true,

      ok:
        true,

      status:
        "allowed",

      reason:
        "accepted",

      decidedAt:
        "2026-08-15T20:00:00.000Z",

      phase5PreflightAccepted:
        true,

      registryReadCaptured:
        true,

      stages: {
        resolver: {
          attempted:
            true,
          status:
            "accepted",
          reason:
            "accepted",
          networkCalled:
            true,
        },

        identityKeyBinding: {
          attempted:
            true,
          status:
            "accepted",
          reason:
            "accepted",
          networkCalled:
            true,
        },

        cardCapabilityFreshness: {
          attempted:
            true,
          status:
            "accepted",
          reason:
            "accepted",
          networkCalled:
            true,
        },
      },

      evidence: {
        registryIdentity: {
          network:
            "ccd:testnet",

          contract: {
            index:
              "12802",
            subindex:
              0,
          },

          moduleReference:
            "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

          agentTokenId:
            "287",

          tokenAddress:
            "ccd:testnet/cis2:12802-0-287",
        },

        accountability: {
          ownerAccount:
            "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

          ownerAccountBound:
            true,

          ownerIdentityAssurance:
            "not_evaluated",

          registryStatus:
            "Active",
        },

        keyBinding: {
          required:
            true,

          verified:
            true,

          bindingType:
            "CIS-8",

          keyFingerprint:
            "sha256:demo4-d4-2-offline-contract-fixture",
        },

        agentCard: {
          expectedHash:
            "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",

          actualHash:
            "6ac669950e9b18c444e549474615c0ce6555910b1e59ab6a599351cf31e10c38",

          byteLength:
            1024,

          integrityVerified:
            true,
        },

        capabilities: {
          required: [
            "authorize_payment_and_resource_access",
          ],

          satisfied: [
            "authorize_payment_and_resource_access",
          ],

          missing: [],

          policySatisfied:
            true,
        },

        freshness: {
          source:
            "direct_chain",

          finalizedBlockHeight:
            46_800_000,

          finalizedBlockHash:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

          observedAt:
            "2026-08-15T20:00:00.000Z",

          evidenceAgeSeconds:
            1,

          indexerLagBlocks:
            null,

          revalidationRequired:
            false,

          fresh:
            true,
        },
      },

      paymentEligibilityHandoff: {
        type:
          "xcf.authorization.payment-eligibility-handoff",

        version:
          "1.0.0",

        eligible:
          true,

        decidedAt:
          "2026-08-15T20:00:00.000Z",

        challenge: {
          nonce:
            "demo4-d4-2-offline-nonce",

          challengeHash:
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",

          issuedAt:
            1_800_000_000,

          expiresAt:
            1_800_000_300,
        },

        scope: {
          merchantId:
            "demo-merchant",

          resource: {
            method:
              "GET",

            path:
              "/paid-gated",
          },

          contractId:
            "demo4-d4-2",

          contractVersion:
            "1.0.0",

          allowedAction:
            "authorize_payment_and_resource_access",

          maxUses:
            1,
        },

        payment: {
          network:
            "ccd:testnet",

          asset: {
            type:
              "PLT",

            tokenId:
              "EUDemo",

            decimals:
              6,
          },

          amount:
            "0.050101",

          payTo:
            "demo-pay-to",
        },

        registry: {
          network:
            "ccd:testnet",

          contract: {
            index:
              "12802",

            subindex:
              0,
          },

          moduleReference:
            "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",

          agentTokenId:
            "287",

          tokenAddress:
            "ccd:testnet/cis2:12802-0-287",

          ownerAccount:
            "4Wx1vpgAfpE6k9ksmtYaH6z4iQN61LFFRUgbbG6gDro1ziKNL7",

          ownerIdentityAssurance:
            "not_evaluated",

          finalizedBlockHeight:
            46_800_000,

          finalizedBlockHash:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

          observedAt:
            "2026-08-15T20:00:00.000Z",

          evidenceAgeSeconds:
            1,
        },

        keyBinding: {
          bindingType:
            "CIS-8",

          keyFingerprint:
            "sha256:demo4-d4-2-offline-contract-fixture",
        },

        capabilities: {
          required: [
            "authorize_payment_and_resource_access",
          ],

          satisfied: [
            "authorize_payment_and_resource_access",
          ],
        },

        paymentAttempted:
          false,

        productionActivation:
          false,
      },

      agentRegistryLookupAttempted:
        true,

      registryNetworkCalled:
        true,

      cis8LookupAttempted:
        true,

      agentCardFetchAttempted:
        true,

      agentCardNetworkCalled:
        true,

      buyerPolicyEvaluated:
        false,

      auditPersistenceAttempted:
        false,

      phase5StateMutated:
        false,

      canonicalStateMutated:
        false,

      boundedUseConsumed:
        false,

      replayStateMutated:
        false,

      ufxCalled:
        false,

      crpCalled:
        false,

      paymentAttempted:
        false,

      receiptIssued:
        false,

      paymentResponseEmitted:
        false,

      resourceReleased:
        false,

      transactionSubmitted:
        false,

      signingKeyUsed:
        false,

      productionActivation:
        false,
    },

    registryAudit: {
      ok:
        true,

      reason:
        "inserted",

      decision:
        "allowed",

      auditPersisted:
        true,

      persistenceAttempted:
        true,

      databaseCalled:
        true,

      auditId:
        "1",

      recordedAt:
        "2026-08-15T20:00:01.000Z",

      registryEvidenceHash:
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",

      authorizationEvidenceHash:
        "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",

      updateAttempted:
        false,

      deleteAttempted:
        false,

      rawMaterialPersisted:
        false,

      productionActivation:
        false,
    },

    buyerPolicy: {
      ok:
        true,

      status:
        "allowed",

      mode:
        "test_fixture_only",

      reason:
        "policy_satisfied",

      authorizationAccepted:
        true,

      authorizationReason:
        "accepted",

      authorizationBindingEvaluated:
        true,

      policyEvaluated:
        true,

      policyDecision:
        "allow",

      policyProofType:
        "concordium.VerifiablePresentation",

      buyerCommitmentPresent:
        true,

      policySubjectPresent:
        true,

      region:
        "EU",

      ageClaim:
        21,

      ageClaimSource:
        "ageOver",

      requiredMinimumAge:
        18,

      rawProofPrinted:
        false,

      gatewayCalled:
        false,

      crpCalled:
        false,

      paymentAttempted:
        false,

      receiptJwsPrinted:
        false,

      paymentResponsePrinted:
        false,

      protectedResourceReleased:
        false,

      replayStateMutated:
        false,

      policyStatePersisted:
        false,

      productionActivation:
        false,
    },

    usage: {
      found:
        false,
    },
  } as Demo4D42RegisteredAgentAuthorizationPreflightInputV1;
}

function assertClosed(
  result:
    ReturnType<
      typeof evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1
    >,
): void {
  assert.equal(
    result.phase5SourceModified,
    false,
  );

  assert.equal(
    result.phase5ClaimInvoked,
    false,
  );

  assert.equal(
    result.policyStateMutated,
    false,
  );

  assert.equal(
    result.canonicalStateMutated,
    false,
  );

  assert.equal(
    result.usageClaimCreated,
    false,
  );

  assert.equal(
    result.boundedUseConsumed,
    false,
  );

  assert.equal(
    result.paymentAttempted,
    false,
  );

  assert.equal(
    result.receiptRequested,
    false,
  );

  assert.equal(
    result.receiptIssued,
    false,
  );

  assert.equal(
    result.paymentResponseEmitted,
    false,
  );

  assert.equal(
    result.resourceReleased,
    false,
  );

  assert.equal(
    result.walletRead,
    false,
  );

  assert.equal(
    result.privateKeyRead,
    false,
  );

  assert.equal(
    result.signingKeyUsed,
    false,
  );

  assert.equal(
    result.contractDryRunPerformed,
    false,
  );

  assert.equal(
    result.transactionConstructed,
    false,
  );

  assert.equal(
    result.transactionSubmitted,
    false,
  );

  assert.equal(
    result.productionActivation,
    false,
  );
}

function main(): void {
  const ready =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      baseInput(),
    );

  assert.equal(
    ready.ok,
    true,
  );

  assert.equal(
    ready.status,
    "ready",
  );

  assert.equal(
    ready.reason,
    DEMO4_D4_2_SUCCESS_REASON,
  );

  assert.equal(
    ready.lifecycleReady,
    true,
  );

  assert.equal(
    ready.revocationClear,
    true,
  );

  assert.equal(
    ready.liveRegisteredAgentTrustSatisfied,
    true,
  );

  assert.equal(
    ready.sanitizedAppendOnlyAuditPersisted,
    true,
  );

  assert.equal(
    ready.buyerPolicyEvaluated,
    true,
  );

  assert.equal(
    ready.buyerPolicySatisfied,
    true,
  );

  assert.equal(
    ready.boundedUseChecked,
    true,
  );

  assert.equal(
    ready.boundedUseEligible,
    true,
  );

  assert.equal(
    ready.usageRowFound,
    false,
  );

  assert.equal(
    ready.consumedUses,
    0,
  );

  assert.equal(
    ready.maxUses,
    1,
  );

  assert.equal(
    ready.remainingUses,
    1,
  );

  assertClosed(
    ready,
  );

  const controlled =
    baseInput();

  controlled.liveProfile = {
    ...controlled.liveProfile,
    controlledEvidenceActive:
      true,
  };

  const controlledResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      controlled,
    );

  assert.equal(
    controlledResult.ok,
    false,
  );

  assert.equal(
    controlledResult.reason,
    "live_registered_agent_profile_invalid",
  );

  assertClosed(
    controlledResult,
  );

  const revalidation =
    baseInput();

  revalidation.registeredAgentAuthorization = {
    ...revalidation.registeredAgentAuthorization,
    ok:
      false,
    status:
      "revalidation_required",
    reason:
      "agent_registry_revalidation_required",
    paymentEligibilityHandoff:
      null,
  };

  const revalidationResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      revalidation,
    );

  assert.equal(
    revalidationResult.status,
    "revalidation_required",
  );

  assert.equal(
    revalidationResult.reason,
    "registered_agent_revalidation_required",
  );

  assertClosed(
    revalidationResult,
  );

  const deniedPolicy =
    baseInput();

  deniedPolicy.buyerPolicy = {
    ...deniedPolicy.buyerPolicy,
    ok:
      false,
    status:
      "denied",
    reason:
      "age_requirement_not_met",
    policyDecision:
      "deny",
  };

  const deniedPolicyResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      deniedPolicy,
    );

  assert.equal(
    deniedPolicyResult.reason,
    "buyer_policy_not_satisfied",
  );

  assert.equal(
    deniedPolicyResult.boundedUseChecked,
    false,
  );

  assertClosed(
    deniedPolicyResult,
  );

  const existingUnusedUsage =
    baseInput();

  existingUnusedUsage.usage = {
    found:
      true,

    credentialHash:
      existingUnusedUsage.lifecycle
        .lifecycleContract!
        .credentialHash,

    delegationId:
      existingUnusedUsage.lifecycle
        .lifecycleContract!
        .delegationId,

    revocationId:
      existingUnusedUsage.lifecycle
        .lifecycleContract!
        .revocationId,

    buyerKeyVersion:
      1,

    agentKeyVersion:
      1,

    maxUses:
      1,

    consumedUses:
      0,

    claimCount:
      0,
  };

  const existingUnusedResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      existingUnusedUsage,
    );

  assert.equal(
    existingUnusedResult.ok,
    true,
  );

  assert.equal(
    existingUnusedResult.boundedUseEligible,
    true,
  );

  assert.equal(
    existingUnusedResult.remainingUses,
    1,
  );

  assertClosed(
    existingUnusedResult,
  );

  const exhausted =
    baseInput();

  exhausted.usage = {
    found:
      true,

    credentialHash:
      exhausted.lifecycle
        .lifecycleContract!
        .credentialHash,

    delegationId:
      exhausted.lifecycle
        .lifecycleContract!
        .delegationId,

    revocationId:
      exhausted.lifecycle
        .lifecycleContract!
        .revocationId,

    buyerKeyVersion:
      1,

    agentKeyVersion:
      1,

    maxUses:
      1,

    consumedUses:
      1,

    claimCount:
      1,
  };

  const exhaustedResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      exhausted,
    );

  assert.equal(
    exhaustedResult.ok,
    false,
  );

  assert.equal(
    exhaustedResult.reason,
    "bounded_use_exhausted",
  );

  assert.equal(
    exhaustedResult.boundedUseEligible,
    false,
  );

  assertClosed(
    exhaustedResult,
  );

  const inconsistent =
    baseInput();

  inconsistent.usage = {
    found:
      true,

    credentialHash:
      inconsistent.lifecycle
        .lifecycleContract!
        .credentialHash,

    delegationId:
      inconsistent.lifecycle
        .lifecycleContract!
        .delegationId,

    revocationId:
      inconsistent.lifecycle
        .lifecycleContract!
        .revocationId,

    buyerKeyVersion:
      1,

    agentKeyVersion:
      1,

    maxUses:
      1,

    consumedUses:
      0,

    claimCount:
      1,
  };

  const inconsistentResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      inconsistent,
    );

  assert.equal(
    inconsistentResult.reason,
    "bounded_use_state_invalid",
  );

  assertClosed(
    inconsistentResult,
  );

  const auditFailure =
    baseInput();

  auditFailure.registryAudit = {
    ...auditFailure.registryAudit,
    ok:
      false,
    reason:
      "insert_not_confirmed",
    auditPersisted:
      false,
    auditId:
      null,
    recordedAt:
      null,
  };

  const auditFailureResult =
    evaluateDemo4D42RegisteredAgentAuthorizationPreflightV1(
      auditFailure,
    );

  assert.equal(
    auditFailureResult.reason,
    "sanitized_append_only_audit_not_persisted",
  );

  assertClosed(
    auditFailureResult,
  );

  const gatewayProxyPreclaimInput:
    Demo4D42GatewayProxyPreclaimContractInputV1 = {
      challenge: {
        source:
          "gateway_proxy",

        gatewayAuthored:
          true,

        resourceMethod:
          "GET",

        resourcePath:
          DEMO4_D4_2_GATEWAY_PROXY_RESOURCE_PATH,

        canonicalLookup:
          DEMO4_D4_2_CANONICAL_CHALLENGE_LOOKUP,

        canonicalChallengeFound:
          true,

        nonce:
          "demo4-d4-2-gateway-nonce",

        challengeId:
          "demo4-d4-2-gateway-challenge",
      },

      redeemShape: {
        nonce:
          "demo4-d4-2-gateway-nonce",

        authorizationProof: {
          authorizationProofType:
            "xcf.agent-delegated-authorization",
        },

        agentRegistryReference: {
          agentTokenId:
            "287",
        },
      },

      intendedRedeemPath:
        DEMO4_D4_2_GATEWAY_PROXY_REDEEM_PATH,

      redeemInvocationAllowed:
        false,

      usageBoundary:
        DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY,

      claimBoundary:
        DEMO4_D4_2_FORBIDDEN_CLAIM_BOUNDARY,

      claimInvocationAllowed:
        false,
    };

  const gatewayProxyPreclaim =
    evaluateDemo4D42GatewayProxyPreclaimContractV1(
      gatewayProxyPreclaimInput,
    );

  assert.equal(
    gatewayProxyPreclaim.ok,
    true,
  );

  assert.equal(
    gatewayProxyPreclaim.reason,
    DEMO4_D4_2_GATEWAY_PROXY_PRECLAIM_READY_REASON,
  );

  assert.equal(
    gatewayProxyPreclaim.gatewayProxyArchitecturePreserved,
    true,
  );

  assert.equal(
    gatewayProxyPreclaim.gatewayAuthoredCanonicalChallengeRequired,
    true,
  );

  assert.equal(
    gatewayProxyPreclaim.redeemRequestShapeValidated,
    true,
  );

  assert.equal(
    gatewayProxyPreclaim.intendedRedeemPath,
    "/paid-gated/redeem",
  );

  assert.equal(
    gatewayProxyPreclaim.redeemInvocationAllowed,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.redeemInvoked,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.boundedUseEligibilityReadOnly,
    true,
  );

  assert.equal(
    gatewayProxyPreclaim.usageBoundary,
    "getPhase5AgentDelegationUsageSnapshot",
  );

  assert.equal(
    gatewayProxyPreclaim.phase5ClaimInvocationAllowed,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.phase5ClaimInvoked,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.liveDispatchAllowed,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.databaseCalled,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.networkCalled,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.boundedUseConsumed,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.paymentAttempted,
    false,
  );

  assert.equal(
    gatewayProxyPreclaim.resourceReleased,
    false,
  );

  const nonceMismatch =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      redeemShape: {
        ...gatewayProxyPreclaimInput
          .redeemShape,

        nonce:
          "different-nonce",
      },
    });

  assert.equal(
    nonceMismatch.ok,
    false,
  );

  assert.equal(
    nonceMismatch.reason,
    "canonical_nonce_mismatch",
  );

  const missingAuthorizationProof =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      redeemShape: {
        ...gatewayProxyPreclaimInput
          .redeemShape,

        authorizationProof:
          null,
      },
    });

  assert.equal(
    missingAuthorizationProof.ok,
    false,
  );

  assert.equal(
    missingAuthorizationProof.reason,
    "redeem_request_shape_invalid",
  );

  const missingRegistryReference =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      redeemShape: {
        ...gatewayProxyPreclaimInput
          .redeemShape,

        agentRegistryReference:
          null,
      },
    });

  assert.equal(
    missingRegistryReference.ok,
    false,
  );

  assert.equal(
    missingRegistryReference.reason,
    "redeem_request_shape_invalid",
  );

  const nonGatewayChallenge =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      challenge: {
        ...gatewayProxyPreclaimInput
          .challenge,

        gatewayAuthored:
          false as true,
      },
    });

  assert.equal(
    nonGatewayChallenge.ok,
    false,
  );

  assert.equal(
    nonGatewayChallenge.reason,
    "gateway_challenge_provenance_invalid",
  );

  const redeemNotProhibited =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      redeemInvocationAllowed:
        true as false,
    });

  assert.equal(
    redeemNotProhibited.ok,
    false,
  );

  assert.equal(
    redeemNotProhibited.reason,
    "redeem_invocation_not_prohibited",
  );

  const wrongUsageBoundary =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      usageBoundary:
        "mutating_usage_boundary" as
          typeof DEMO4_D4_2_READ_ONLY_USAGE_BOUNDARY,
    });

  assert.equal(
    wrongUsageBoundary.ok,
    false,
  );

  assert.equal(
    wrongUsageBoundary.reason,
    "read_only_usage_boundary_invalid",
  );

  const claimNotProhibited =
    evaluateDemo4D42GatewayProxyPreclaimContractV1({
      ...gatewayProxyPreclaimInput,

      claimInvocationAllowed:
        true as false,
    });

  assert.equal(
    claimNotProhibited.ok,
    false,
  );

  assert.equal(
    claimNotProhibited.reason,
    "phase5_claim_boundary_not_prohibited",
  );

  const liveBundle =
    buildDemo4D42LiveTransportBundleV1();

  assert.equal(
    Array.isArray(
      DEMO4_D4_2_CAPABILITY_RULES,
    ),
    true,
  );

  assert.deepEqual(
    DEMO4_D4_2_CAPABILITY_RULES,
    [
      {
        capabilityId:
          "x402.payment.authorize",

        source:
          "x402_support",

        expected:
          true,
      },
      {
        capabilityId:
          "resource.premium.read",

        source:
          "oasf_skill",

        skill:
          "resource.premium.read",
      },
    ],
  );

  assert.equal(
    liveBundle.registryConfig.network,
    DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
      .phase6RegistryNetwork,
  );

  assert.deepEqual(
    liveBundle.registryConfig.contract,
    {
      index:
        "12802",

      subindex:
        0,
    },
  );

  assert.equal(
    liveBundle.registryConfig.moduleReference,
    "33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  );

  assert.equal(
    liveBundle.registryConfig.contractName,
    "CIS-8004",
  );

  assert.equal(
    liveBundle.registryConfig.entrypoint,
    "agentOf",
  );

  assert.equal(
    liveBundle.registryConfig.grpc.host,
    "grpc.testnet.concordium.com",
  );

  assert.equal(
    liveBundle.registryConfig.grpc.port,
    20_000,
  );

  assert.equal(
    liveBundle.registryConfig.grpc.tls,
    true,
  );

  assert.equal(
    liveBundle.registryConfig.timeoutMs,
    10_000,
  );

  assert.equal(
    liveBundle.registryConfig.transport,
    liveBundle.registryTransport.kind,
  );

  assert.equal(
    liveBundle.registryTransport
      instanceof ConcordiumGrpcCis8004ReadTransportV1,
    true,
  );

  assert.equal(
    liveBundle.trustedCis8.network,
    DEMO4_D4_2_LIVE_REGISTERED_AGENT_PROFILE
      .phase6RegistryNetwork,
  );

  assert.deepEqual(
    liveBundle.trustedCis8.contract,
    {
      index:
        "12801",

      subindex:
        0,
    },
  );

  assert.equal(
    liveBundle.trustedCis8.moduleReference,
    "e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",
  );

  assert.equal(
    liveBundle.trustedCis8.contractName,
    "CIS-8",
  );

  assert.equal(
    liveBundle.trustedCis8.entrypoint,
    "ownerOfKey",
  );

  assert.equal(
    liveBundle.trustedCis8.grpc.host,
    "grpc.testnet.concordium.com",
  );

  assert.equal(
    liveBundle.trustedCis8.grpc.port,
    20_000,
  );

  assert.equal(
    liveBundle.trustedCis8.grpc.tls,
    true,
  );

  assert.equal(
    liveBundle.trustedCis8.timeoutMs,
    10_000,
  );

  assert.equal(
    liveBundle.trustedCis8.transport,
    liveBundle.cis8Transport.kind,
  );

  assert.equal(
    liveBundle.cis8Transport
      instanceof ConcordiumGrpcCis8ReadTransportV1,
    true,
  );

  assert.equal(
    liveBundle.agentCardTransport
      instanceof HttpsAgentCardFetchTransportV1,
    true,
  );

  assert.equal(
    liveBundle.controlledRegistryTransportUsed,
    false,
  );

  assert.equal(
    liveBundle.controlledCis8TransportUsed,
    false,
  );

  assert.equal(
    liveBundle.deterministicAgentCardTransportUsed,
    false,
  );

  assert.equal(
    liveBundle.liveToControlledFallbackAllowed,
    false,
  );

  assert.equal(
    liveBundle.networkCalled,
    false,
  );

  assert.equal(
    liveBundle.databaseCalled,
    false,
  );

  const runnerInspect =
    demo4D42RunnerDispatchStateForTestV1({
      DEMO4_D4_2_MODE:
        "inspect",

      DEMO4_D4_2_LIVE_READ_ENABLED:
        "false",

      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED:
        "false",
    });

  assert.equal(
    runnerInspect.dispatchAllowed,
    false,
  );

  assert.equal(
    runnerInspect.reason,
    "offline_inspect_only",
  );

  assert.equal(
    runnerInspect.liveReadImplementationWired,
    true,
  );

  assert.equal(
    runnerInspect.databaseReadImplementationWired,
    true,
  );

  assert.equal(
    runnerInspect.databaseAuditPersistenceWired,
    true,
  );

  assert.equal(
    runnerInspect.liveReadActivationPresent,
    false,
  );

  assert.equal(
    runnerInspect.auditWriteActivationPresent,
    false,
  );

  assert.equal(
    runnerInspect.networkCalled,
    false,
  );

  assert.equal(
    runnerInspect.databaseCalled,
    false,
  );

  const runnerLiveRequestBlocked =
    demo4D42RunnerDispatchStateForTestV1({
      DEMO4_D4_2_MODE:
        "live_read_only",

      DEMO4_D4_2_LIVE_READ_ENABLED:
        "false",

      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED:
        "false",
    });

  assert.equal(
    runnerLiveRequestBlocked.dispatchAllowed,
    false,
  );

  assert.equal(
    runnerLiveRequestBlocked.reason,
    "live_read_only_activation_required",
  );

  assert.equal(
    runnerLiveRequestBlocked.liveReadImplementationWired,
    true,
  );

  assert.equal(
    runnerLiveRequestBlocked.databaseReadImplementationWired,
    true,
  );

  assert.equal(
    runnerLiveRequestBlocked.databaseAuditPersistenceWired,
    true,
  );

  assert.equal(
    runnerLiveRequestBlocked.liveReadActivationPresent,
    false,
  );

  assert.equal(
    runnerLiveRequestBlocked.auditWriteActivationPresent,
    false,
  );

  assert.equal(
    runnerLiveRequestBlocked.networkCalled,
    false,
  );

  assert.equal(
    runnerLiveRequestBlocked.databaseCalled,
    false,
  );

  const runnerLiveReadGateOnly =
    demo4D42RunnerDispatchStateForTestV1({
      DEMO4_D4_2_MODE:
        "live_read_only",

      DEMO4_D4_2_LIVE_READ_ENABLED:
        "true",

      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED:
        "false",
    });

  assert.equal(
    runnerLiveReadGateOnly.dispatchAllowed,
    true,
  );

  assert.equal(
    runnerLiveReadGateOnly.reason,
    "live_read_only_dispatch_ready",
  );

  assert.equal(
    runnerLiveReadGateOnly.liveReadActivationPresent,
    true,
  );

  assert.equal(
    runnerLiveReadGateOnly.auditWriteActivationPresent,
    false,
  );

  assert.equal(
    runnerLiveReadGateOnly.networkCalled,
    false,
  );

  assert.equal(
    runnerLiveReadGateOnly.databaseCalled,
    false,
  );

  const runnerLiveReadAndAuditGates =
    demo4D42RunnerDispatchStateForTestV1({
      DEMO4_D4_2_MODE:
        "live_read_only",

      DEMO4_D4_2_LIVE_READ_ENABLED:
        "true",

      DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED:
        "true",
    });

  assert.equal(
    runnerLiveReadAndAuditGates.dispatchAllowed,
    true,
  );

  assert.equal(
    runnerLiveReadAndAuditGates.reason,
    "live_read_only_dispatch_ready",
  );

  assert.equal(
    runnerLiveReadAndAuditGates.liveReadActivationPresent,
    true,
  );

  assert.equal(
    runnerLiveReadAndAuditGates.auditWriteActivationPresent,
    true,
  );

  assert.equal(
    runnerLiveReadAndAuditGates.networkCalled,
    false,
  );

  assert.equal(
    runnerLiveReadAndAuditGates.databaseCalled,
    false,
  );

  console.log(
    "PR316_D4_2_OFFLINE_CONTRACT_TEST=PASSED",
  );

  console.log(
    `SUCCESS_REASON=${DEMO4_D4_2_SUCCESS_REASON}`,
  );

  console.log(
    "ARCHITECTURAL_OWNER=phase6_d4_2_seam",
  );

  console.log(
    "PHASE5_SOURCE_MODIFIED=false",
  );

  console.log(
    "CONTROLLED_POSITIVE_FALLBACK=false",
  );

  console.log(
    "GATEWAY_PROXY_PRECLAIM_CONTRACT=PASSED",
  );

  console.log(
    "GATEWAY_AUTHORED_CANONICAL_CHALLENGE_REQUIRED=true",
  );

  console.log(
    "REDEEM_REQUEST_SHAPE=nonce_authorizationProof_agentRegistryReference",
  );

  console.log(
    "D4_2_REDEEM_INVOCATION_ALLOWED=false",
  );

  console.log(
    "D4_2_USAGE_BOUNDARY=getPhase5AgentDelegationUsageSnapshot",
  );

  console.log(
    "D4_2_PHASE5_CLAIM_INVOCATION_ALLOWED=false",
  );

  console.log(
    "LIVE_TRANSPORT_PROVENANCE_BUNDLE=PASSED",
  );

  console.log(
    "CIS8004_GENERIC_DEFAULT_USED=false",
  );

  console.log(
    "CIS8004_MODULE_PIN=33e6e42b9d6610acc6c556aaba003cbc4d0de3c6089eab434ef9f7024b72d833",
  );

  console.log(
    "CIS8_GENERIC_DEFAULT_USED=false",
  );

  console.log(
    "CIS8_MODULE_PIN=e003cc210627c96b817983a701734a3fb6a77ec25782dc792524259e77573d61",
  );

  console.log(
    "HTTPS_AGENT_CARD_TRANSPORT_PINNED=true",
  );

  console.log(
    "LIVE_READ_IMPLEMENTATION_WIRED=true",
  );

  console.log(
    "DATABASE_READ_IMPLEMENTATION_WIRED=true",
  );

  console.log(
    "DATABASE_AUDIT_PERSISTENCE_WIRED=true",
  );

  console.log(
    "LIVE_READ_RUNTIME_GATE=DEMO4_D4_2_LIVE_READ_ENABLED",
  );

  console.log(
    "AUDIT_WRITE_RUNTIME_GATE=DEMO4_D4_2_PHASE6_AUDIT_WRITE_ENABLED",
  );

  console.log(
    "LIVE_EXECUTION_PERFORMED=false",
  );

  console.log(
    "DATABASE_CALLED=false",
  );

  console.log(
    "NETWORK_CALLED=false",
  );

  console.log(
    "USAGE_CLAIM_CREATED=false",
  );

  console.log(
    "BOUNDED_USE_CONSUMED=false",
  );

  console.log(
    "PAYMENT_ATTEMPTED=false",
  );

  console.log(
    "RESOURCE_RELEASED=false",
  );

  console.log(
    "PRODUCTION_ACTIVATION=false",
  );
}

main();
