/**
 * PR #303 — Agent Registry trust composition for conditional gating.
 *
 * This pure orchestration boundary composes the accepted Phase 5
 * cryptographic preflight with the frozen Phase 6 resolver, acting-key
 * binding, Agent Card integrity, capability, and freshness stages.
 *
 * Every result is produced before buyer-policy evaluation, bounded-use
 * consumption, canonical state mutation, payment, receipt, replay, or
 * resource release.
 */
import type { Phase5AgentRuntimeCryptographicPreflightResult, } from "../phase5/agentRuntimeAuthorization";
import { AGENT_REGISTRY_CONTRACT_VERSION, validateAgentRegistryReferenceV1, validateAgentRegistryRequirementV1, type AgentRegistryReferenceV1, type AgentRegistryRequirementV1, type AgentRegistryTrustResultV1, } from "./agentRegistryTrustContract";
import { resolveAgentRegistryTrustForGatewayV1, type AgentRegistryResolverSeamResultV1, } from "./agentRegistryResolverSeam";
import { bindAgentRegistryIdentityToPhase5ActingKeyV1, type AgentRegistryIdentityKeyBindingResultV1, type ConcordiumCis8ReadTransportV1, type ConcordiumCis8TrustedConfigV1, } from "./agentRegistryIdentityKeyBinding";
import { verifyAgentRegistryCardCapabilityFreshnessV1, type AgentCardFetchTransportV1, type AgentRegistryCardCapabilityFreshnessResultV1, } from "./agentRegistryCardCapabilityFreshness";
import { CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG, CONCORDIUM_CIS8004_TRANSPORT_KIND, ConcordiumCis8004RegistryPluginV1, ConcordiumGrpcCis8004ReadTransportV1, type ConcordiumCis8004ReadRequestV1, type ConcordiumCis8004ReadTransportV1, type ConcordiumCis8004TrustedRegistryConfigV1, } from "./concordiumCis8004RegistryPlugin";
export const PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_TYPE = "xcf.agent-registry.conditional-gating-authorization" as const;
export const PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_MODE = "controlled_gateway_composition" as const;
export const PHASE6_PAYMENT_ELIGIBILITY_HANDOFF_TYPE = "xcf.authorization.payment-eligibility-handoff" as const;
export type Phase6AgentRegistryConditionalGatingStatusV1 = "allowed" | "denied" | "revalidation_required";
type AcceptedPhase5Preflight = Extract<Phase5AgentRuntimeCryptographicPreflightResult, {
    readonly ok: true;
}>;
export type Phase6AgentRegistryConditionalGatingInputV1 = {
    readonly phase5Preflight: Phase5AgentRuntimeCryptographicPreflightResult;
    readonly requirement: unknown;
    readonly reference: unknown;
    readonly capabilityRules: unknown;
    readonly now: string;
    readonly registryTransport?: ConcordiumCis8004ReadTransportV1;
    readonly registryConfig?: ConcordiumCis8004TrustedRegistryConfigV1;
    readonly trustedCis8?: ConcordiumCis8TrustedConfigV1;
    readonly cis8Transport?: ConcordiumCis8ReadTransportV1;
    readonly agentCardTransport?: AgentCardFetchTransportV1;
    readonly maxAgentCardBytes?: number;
    readonly agentCardFetchTimeoutMs?: number;
};
export type Phase6AgentRegistryStageDecisionV1 = {
    readonly attempted: boolean;
    readonly status: string | null;
    readonly reason: string | null;
    readonly networkCalled: boolean;
};
export type Phase6AgentRegistrySanitizedEvidenceV1 = {
    readonly registryIdentity: {
        readonly network: string | null;
        readonly contract: {
            readonly index: string;
            readonly subindex: number;
        } | null;
        readonly moduleReference: string | null;
        readonly agentTokenId: string | null;
        readonly tokenAddress: string | null;
    };
    readonly accountability: {
        readonly ownerAccount: string | null;
        readonly ownerAccountBound: boolean;
        readonly ownerIdentityAssurance: string | null;
        readonly registryStatus: string | null;
    };
    readonly keyBinding: {
        readonly required: boolean;
        readonly verified: boolean;
        readonly bindingType: string | null;
        readonly keyFingerprint: string | null;
    };
    readonly agentCard: {
        readonly expectedHash: string | null;
        readonly actualHash: string | null;
        readonly byteLength: number | null;
        readonly integrityVerified: boolean;
    };
    readonly capabilities: {
        readonly required: readonly string[];
        readonly satisfied: readonly string[];
        readonly missing: readonly string[];
        readonly policySatisfied: boolean;
    };
    readonly freshness: {
        readonly source: string | null;
        readonly finalizedBlockHeight: number | null;
        readonly finalizedBlockHash: string | null;
        readonly observedAt: string | null;
        readonly evidenceAgeSeconds: number | null;
        readonly indexerLagBlocks: number | null;
        readonly revalidationRequired: boolean;
        readonly fresh: boolean;
    };
};
export type Phase6PaymentEligibilityHandoffV1 = {
    readonly type: typeof PHASE6_PAYMENT_ELIGIBILITY_HANDOFF_TYPE;
    readonly version: typeof AGENT_REGISTRY_CONTRACT_VERSION;
    readonly eligible: true;
    readonly decidedAt: string;
    readonly challenge: {
        readonly nonce: string;
        readonly challengeHash: string;
        readonly issuedAt: number | null;
        readonly expiresAt: number | null;
    };
    readonly scope: {
        readonly merchantId: string;
        readonly resource: {
            readonly method: string;
            readonly path: string;
        };
        readonly contractId: string;
        readonly contractVersion: string;
        readonly allowedAction: string;
        readonly maxUses: number;
    };
    readonly payment: {
        readonly network: string;
        readonly asset: {
            readonly type: string;
            readonly tokenId: string;
            readonly decimals: number;
        };
        readonly amount: string;
        readonly payTo: string;
    };
    readonly registry: {
        readonly network: string;
        readonly contract: {
            readonly index: string;
            readonly subindex: number;
        };
        readonly moduleReference: string | null;
        readonly agentTokenId: string;
        readonly tokenAddress: string;
        readonly ownerAccount: string;
        readonly ownerIdentityAssurance: "not_evaluated";
        readonly finalizedBlockHeight: number;
        readonly finalizedBlockHash: string;
        readonly observedAt: string;
        readonly evidenceAgeSeconds: number;
    };
    readonly keyBinding: {
        readonly bindingType: string;
        readonly keyFingerprint: string;
    };
    readonly capabilities: {
        readonly required: readonly string[];
        readonly satisfied: readonly string[];
    };
    readonly paymentAttempted: false;
    readonly productionActivation: false;
};
export type Phase6AgentRegistryConditionalGatingResultV1 = {
    readonly type: typeof PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_TYPE;
    readonly version: typeof AGENT_REGISTRY_CONTRACT_VERSION;
    readonly mode: typeof PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_MODE;
    readonly testOnly: true;
    readonly ok: boolean;
    readonly status: Phase6AgentRegistryConditionalGatingStatusV1;
    readonly reason: string;
    readonly decidedAt: string | null;
    readonly phase5PreflightAccepted: boolean;
    readonly registryReadCaptured: boolean;
    readonly stages: {
        readonly resolver: Phase6AgentRegistryStageDecisionV1;
        readonly identityKeyBinding: Phase6AgentRegistryStageDecisionV1;
        readonly cardCapabilityFreshness: Phase6AgentRegistryStageDecisionV1;
    };
    readonly evidence: Phase6AgentRegistrySanitizedEvidenceV1;
    readonly paymentEligibilityHandoff: Phase6PaymentEligibilityHandoffV1 | null;
    readonly agentRegistryLookupAttempted: boolean;
    readonly registryNetworkCalled: boolean;
    readonly cis8LookupAttempted: boolean;
    readonly agentCardFetchAttempted: boolean;
    readonly agentCardNetworkCalled: boolean;
    readonly buyerPolicyEvaluated: false;
    readonly auditPersistenceAttempted: false;
    readonly phase5StateMutated: false;
    readonly canonicalStateMutated: false;
    readonly boundedUseConsumed: false;
    readonly replayStateMutated: false;
    readonly ufxCalled: false;
    readonly crpCalled: false;
    readonly paymentAttempted: false;
    readonly receiptIssued: false;
    readonly paymentResponseEmitted: false;
    readonly resourceReleased: false;
    readonly transactionSubmitted: false;
    readonly signingKeyUsed: false;
    readonly productionActivation: false;
};
class RecordingCis8004ReadTransportV1 implements ConcordiumCis8004ReadTransportV1 {
    readonly kind = CONCORDIUM_CIS8004_TRANSPORT_KIND;
    private capturedResult: unknown | null = null;
    constructor(private readonly delegate: ConcordiumCis8004ReadTransportV1) { }
    async read(request: ConcordiumCis8004ReadRequestV1): Promise<unknown> {
        const result = await this.delegate.read(request);
        this.capturedResult =
            result;
        return result;
    }
    latestResult(): unknown | null {
        return this.capturedResult;
    }
}
function canonicalTimestamp(value: string): string | null {
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) {
        return null;
    }
    try {
        return new Date(milliseconds).toISOString() ===
            value
            ? value
            : null;
    }
    catch {
        return null;
    }
}
export function deriveAgentRegistryBaseLookupRequirementV1(requirement: AgentRegistryRequirementV1): AgentRegistryRequirementV1 {
    return {
        ...requirement,
        trustedRegistries: requirement
            .trustedRegistries
            .map((registry) => ({
            network: registry.network,
            contract: {
                index: registry.contract.index,
                subindex: registry.contract.subindex,
            },
            ...(registry.moduleReference ===
                undefined
                ? {}
                : {
                    moduleReference: registry.moduleReference,
                }),
        })),
        requireAgentCardIntegrity: false,
        requiredCapabilities: [],
        requireVerifiedOwnerIdentity: false,
        externalKeyPolicy: "optional",
    };
}
function strictConditionalGatingRequirement(requirement: AgentRegistryRequirementV1): boolean {
    return (requirement.required ===
        true &&
        requirement.requiredStatus ===
            "Active" &&
        requirement.requireOwnerAccountBinding ===
            true &&
        requirement.requireVerifiedOwnerIdentity ===
            false &&
        requirement.externalKeyPolicy ===
            "required" &&
        requirement.requireAgentCardIntegrity ===
            true &&
        requirement.requiredCapabilities.length >
            0 &&
        requirement.maxIndexerLagBlocks ===
            undefined &&
        requirement.revalidateBeforeReleaseIfOlderThanSeconds >
            0 &&
        requirement.revalidateBeforeReleaseIfOlderThanSeconds <=
            requirement.maxEvidenceAgeSeconds);
}
function emptyStage(): Phase6AgentRegistryStageDecisionV1 {
    return {
        attempted: false,
        status: null,
        reason: null,
        networkCalled: false,
    };
}
function resolverStage(result: AgentRegistryResolverSeamResultV1 | null): Phase6AgentRegistryStageDecisionV1 {
    return result ===
        null
        ? emptyStage()
        : {
            attempted: result.resolverInvoked,
            status: result.status,
            reason: result.reason,
            networkCalled: result.registryNetworkCalled,
        };
}
function bindingStage(result: AgentRegistryIdentityKeyBindingResultV1 | null): Phase6AgentRegistryStageDecisionV1 {
    return result ===
        null
        ? emptyStage()
        : {
            attempted: result.bindingEvaluated,
            status: result.status,
            reason: result.reason,
            networkCalled: result.cis8LookupAttempted,
        };
}
function cardStage(result: AgentRegistryCardCapabilityFreshnessResultV1 | null): Phase6AgentRegistryStageDecisionV1 {
    return result ===
        null
        ? emptyStage()
        : {
            attempted: result.requirementValidated,
            status: result.status,
            reason: result.reason,
            networkCalled: result.agentCardNetworkCalled,
        };
}
function sanitizedEvidence(resolver: AgentRegistryResolverSeamResultV1 | null, binding: AgentRegistryIdentityKeyBindingResultV1 | null, card: AgentRegistryCardCapabilityFreshnessResultV1 | null): Phase6AgentRegistrySanitizedEvidenceV1 {
    const trust: AgentRegistryTrustResultV1 | null = card?.trustResult ??
        resolver?.trustResult ??
        null;
    const effectiveBinding = card?.identityKeyBinding ??
        binding;
    return {
        registryIdentity: {
            network: trust?.identity.network ??
                null,
            contract: trust ===
                null
                ? null
                : {
                    index: trust.identity.registryContract.index,
                    subindex: trust.identity.registryContract.subindex,
                },
            moduleReference: trust?.identity.moduleReference ??
                null,
            agentTokenId: trust?.identity.agentTokenId ??
                null,
            tokenAddress: trust?.identity.tokenAddress ??
                null,
        },
        accountability: {
            ownerAccount: trust?.state.ownerAccount ??
                null,
            ownerAccountBound: trust?.state.ownerAccountBound ===
                true,
            ownerIdentityAssurance: trust?.state.ownerIdentityAssurance ??
                null,
            registryStatus: trust?.state.status ??
                null,
        },
        keyBinding: {
            required: effectiveBinding?.keyBinding.required ===
                true,
            verified: effectiveBinding?.keyBinding.verified ===
                true,
            bindingType: effectiveBinding?.keyBinding.bindingType ??
                null,
            keyFingerprint: effectiveBinding?.keyBinding.keyFingerprint ??
                null,
        },
        agentCard: {
            expectedHash: card?.cardEvidence.expectedHash ??
                trust?.agentCard.hash ??
                null,
            actualHash: card?.cardEvidence.actualHash ??
                null,
            byteLength: card?.cardEvidence.byteLength ??
                null,
            integrityVerified: card?.cardEvidence.integrityVerified ===
                true,
        },
        capabilities: {
            required: [
                ...(card?.capabilityDecision.required ?? []),
            ],
            satisfied: [
                ...(card?.capabilityDecision.satisfied ?? []),
            ],
            missing: [
                ...(card?.capabilityDecision.missing ?? []),
            ],
            policySatisfied: card?.capabilityDecision.policySatisfied ===
                true,
        },
        freshness: {
            source: card?.freshnessDecision.source ??
                trust?.freshness.source ??
                null,
            finalizedBlockHeight: trust?.freshness.finalizedBlockHeight ??
                null,
            finalizedBlockHash: trust?.freshness.finalizedBlockHash ??
                null,
            observedAt: card?.freshnessDecision.observedAt ??
                trust?.freshness.observedAt ??
                null,
            evidenceAgeSeconds: card?.freshnessDecision.calculatedEvidenceAgeSeconds ??
                trust?.freshness.evidenceAgeSeconds ??
                null,
            indexerLagBlocks: card?.freshnessDecision.indexerLagBlocks ??
                trust?.freshness.indexerLagBlocks ??
                null,
            revalidationRequired: card?.freshnessDecision.revalidationRequired ===
                true,
            fresh: card?.freshnessDecision.fresh ===
                true,
        },
    };
}
function acceptedFreshnessSourceLagProfile(freshness: Phase6AgentRegistrySanitizedEvidenceV1["freshness"]): boolean {
    return ((freshness.source ===
        "direct_chain" &&
        freshness.indexerLagBlocks ===
            null) ||
        ((freshness.source ===
            "fixture" ||
            freshness.source ===
                "auditable_resolver") &&
            freshness.indexerLagBlocks ===
                0));
}
function paymentEligibilityHandoff(preflight: AcceptedPhase5Preflight, decidedAt: string, evidence: Phase6AgentRegistrySanitizedEvidenceV1): Phase6PaymentEligibilityHandoffV1 | null {
    const registry = evidence.registryIdentity;
    const ownerAccount = evidence.accountability.ownerAccount;
    const ownerIdentityAssurance = evidence.accountability.ownerIdentityAssurance;
    const binding = evidence.keyBinding;
    const freshness = evidence.freshness;
    if (registry.network ===
        null ||
        registry.contract ===
            null ||
        registry.agentTokenId ===
            null ||
        registry.tokenAddress ===
            null ||
        ownerAccount ===
            null ||
        evidence.accountability.ownerAccountBound !==
            true ||
        ownerIdentityAssurance !==
            "not_evaluated" ||
        evidence.accountability.registryStatus !==
            "Active" ||
        binding.required !==
            true ||
        binding.verified !==
            true ||
        binding.bindingType ===
            null ||
        binding.keyFingerprint ===
            null ||
        evidence.agentCard.expectedHash ===
            null ||
        evidence.agentCard.actualHash ===
            null ||
        evidence.agentCard.expectedHash !==
            evidence.agentCard.actualHash ||
        evidence.agentCard.integrityVerified !==
            true ||
        evidence.capabilities.required.length ===
            0 ||
        evidence.capabilities.missing.length !==
            0 ||
        evidence.capabilities.policySatisfied !==
            true ||
        freshness.fresh !==
            true ||
        freshness.revalidationRequired ===
            true ||
        freshness.finalizedBlockHeight ===
            null ||
        freshness.finalizedBlockHash ===
            null ||
        freshness.observedAt ===
            null ||
        !acceptedFreshnessSourceLagProfile(
            freshness,
        ) ||
        freshness.evidenceAgeSeconds ===
            null) {
        return null;
    }
    const expected = preflight.expectedContext;
    return {
        type: PHASE6_PAYMENT_ELIGIBILITY_HANDOFF_TYPE,
        version: AGENT_REGISTRY_CONTRACT_VERSION,
        eligible: true,
        decidedAt,
        challenge: {
            nonce: expected.challenge.nonce,
            challengeHash: expected.challenge.challengeHash,
            issuedAt: expected.challenge.issuedAt ??
                null,
            expiresAt: expected.challenge.expiresAt ??
                null,
        },
        scope: {
            merchantId: expected.scope.merchantId,
            resource: {
                method: expected.scope.resourceMethod,
                path: expected.scope.resourcePath,
            },
            contractId: expected.scope.contractId,
            contractVersion: expected.scope.contractVersion,
            allowedAction: expected.scope.allowedAction,
            maxUses: expected.scope.maxUses,
        },
        payment: {
            network: expected.paymentTuple.network,
            asset: {
                type: expected.paymentTuple.assetType,
                tokenId: expected.paymentTuple.tokenId,
                decimals: expected.paymentTuple.decimals,
            },
            amount: expected.paymentTuple.amount,
            payTo: expected.paymentTuple.payTo,
        },
        registry: {
            network: registry.network,
            contract: registry.contract,
            moduleReference: registry.moduleReference,
            agentTokenId: registry.agentTokenId,
            tokenAddress: registry.tokenAddress,
            ownerAccount,
            ownerIdentityAssurance,
            finalizedBlockHeight: freshness.finalizedBlockHeight,
            finalizedBlockHash: freshness.finalizedBlockHash,
            observedAt: freshness.observedAt,
            evidenceAgeSeconds: freshness.evidenceAgeSeconds,
        },
        keyBinding: {
            bindingType: binding.bindingType,
            keyFingerprint: binding.keyFingerprint,
        },
        capabilities: {
            required: [
                ...evidence.capabilities.required,
            ],
            satisfied: [
                ...evidence.capabilities.satisfied,
            ],
        },
        paymentAttempted: false,
        productionActivation: false,
    };
}
type ResultOptions = {
    readonly status: Phase6AgentRegistryConditionalGatingStatusV1;
    readonly reason: string;
    readonly decidedAt: string | null;
    readonly phase5PreflightAccepted: boolean;
    readonly registryReadCaptured?: boolean;
    readonly resolver?: AgentRegistryResolverSeamResultV1 | null;
    readonly binding?: AgentRegistryIdentityKeyBindingResultV1 | null;
    readonly card?: AgentRegistryCardCapabilityFreshnessResultV1 | null;
    readonly handoff?: Phase6PaymentEligibilityHandoffV1 | null;
};
function buildResult(options: ResultOptions): Phase6AgentRegistryConditionalGatingResultV1 {
    const resolver = options.resolver ??
        null;
    const binding = options.binding ??
        null;
    const card = options.card ??
        null;
    const handoff = options.handoff ??
        null;
    return {
        type: PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_TYPE,
        version: AGENT_REGISTRY_CONTRACT_VERSION,
        mode: PHASE6_AGENT_REGISTRY_CONDITIONAL_GATING_MODE,
        testOnly: true,
        ok: options.status ===
            "allowed" &&
            handoff !==
                null,
        status: options.status,
        reason: options.reason,
        decidedAt: options.decidedAt,
        phase5PreflightAccepted: options.phase5PreflightAccepted,
        registryReadCaptured: options.registryReadCaptured ??
            false,
        stages: {
            resolver: resolverStage(resolver),
            identityKeyBinding: bindingStage(binding),
            cardCapabilityFreshness: cardStage(card),
        },
        evidence: sanitizedEvidence(resolver, binding, card),
        paymentEligibilityHandoff: handoff,
        agentRegistryLookupAttempted: resolver?.agentRegistryLookupAttempted ===
            true,
        registryNetworkCalled: resolver?.registryNetworkCalled ===
            true,
        cis8LookupAttempted: binding?.cis8LookupAttempted ===
            true,
        agentCardFetchAttempted: card?.cardEvidence.fetchAttempted ===
            true,
        agentCardNetworkCalled: card?.agentCardNetworkCalled ===
            true,
        buyerPolicyEvaluated: false,
        auditPersistenceAttempted: false,
        phase5StateMutated: false,
        canonicalStateMutated: false,
        boundedUseConsumed: false,
        replayStateMutated: false,
        ufxCalled: false,
        crpCalled: false,
        paymentAttempted: false,
        receiptIssued: false,
        paymentResponseEmitted: false,
        resourceReleased: false,
        transactionSubmitted: false,
        signingKeyUsed: false,
        productionActivation: false,
    };
}
export async function composeAgentRegistryConditionalGatingV1(input: Phase6AgentRegistryConditionalGatingInputV1): Promise<Phase6AgentRegistryConditionalGatingResultV1> {
    const decidedAt = canonicalTimestamp(input.now);
    if (decidedAt ===
        null) {
        return buildResult({
            status: "denied",
            reason: "invalid_composition_time",
            decidedAt: null,
            phase5PreflightAccepted: false,
        });
    }
    if (input.phase5Preflight.ok !==
        true ||
        input.phase5Preflight.cryptographicBinding ===
            null ||
        input.phase5Preflight.delegationDocument ===
            null) {
        return buildResult({
            status: "denied",
            reason: "phase5_preflight_not_accepted",
            decidedAt,
            phase5PreflightAccepted: false,
        });
    }
    const preflight = input.phase5Preflight;
    const requirementValidation = validateAgentRegistryRequirementV1(input.requirement);
    if (!requirementValidation.ok ||
        requirementValidation.value ===
            null) {
        return buildResult({
            status: "denied",
            reason: "agent_registry_requirement_invalid",
            decidedAt,
            phase5PreflightAccepted: true,
        });
    }
    const requirement = requirementValidation.value;
    if (!strictConditionalGatingRequirement(requirement)) {
        return buildResult({
            status: "denied",
            reason: "agent_registry_requirement_not_strict",
            decidedAt,
            phase5PreflightAccepted: true,
        });
    }
    const referenceValidation = validateAgentRegistryReferenceV1(input.reference);
    if (!referenceValidation.ok ||
        referenceValidation.value ===
            null) {
        return buildResult({
            status: "denied",
            reason: "agent_registry_reference_invalid",
            decidedAt,
            phase5PreflightAccepted: true,
        });
    }
    const reference: AgentRegistryReferenceV1 = referenceValidation.value;
    const baseRequirement = deriveAgentRegistryBaseLookupRequirementV1(requirement);
    const baseValidation = validateAgentRegistryRequirementV1(baseRequirement);
    if (!baseValidation.ok ||
        baseValidation.value ===
            null) {
        return buildResult({
            status: "denied",
            reason: "derived_registry_requirement_invalid",
            decidedAt,
            phase5PreflightAccepted: true,
        });
    }
    const recordingTransport = new RecordingCis8004ReadTransportV1(input.registryTransport ??
        new ConcordiumGrpcCis8004ReadTransportV1());
    const registryPlugin = new ConcordiumCis8004RegistryPluginV1(recordingTransport, input.registryConfig ??
        CONCORDIUM_CIS8004_TESTNET_TRUSTED_REGISTRY_CONFIG, () => new Date(decidedAt));
    let resolver: AgentRegistryResolverSeamResultV1;
    try {
        resolver = await resolveAgentRegistryTrustForGatewayV1({
            requirement: baseValidation.value,
            reference,
            resolver: registryPlugin,
        });
    }
    catch {
        return buildResult({
            status: "denied",
            reason: "agent_registry_resolver_exception",
            decidedAt,
            phase5PreflightAccepted: true,
        });
    }
    if (resolver.ok !==
        true ||
        resolver.registryTrustSatisfied !==
            true ||
        resolver.trustResult?.verified !==
            true) {
        return buildResult({
            status: "denied",
            reason: resolver.reason,
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
        });
    }
    const registryReadResult = recordingTransport.latestResult();
    if (registryReadResult ===
        null) {
        return buildResult({
            status: "denied",
            reason: "agent_registry_read_result_missing",
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            registryReadCaptured: false,
        });
    }
    let binding: AgentRegistryIdentityKeyBindingResultV1;
    try {
        binding = await bindAgentRegistryIdentityToPhase5ActingKeyV1({
            phase5BindingResult: preflight.cryptographicBinding,
            delegationDocument: preflight.delegationDocument,
            registryTrustResult: resolver.trustResult,
            registryReadResult,
            expectedAgentTokenId: reference.agentTokenId,
            externalKeyPolicy: requirement.externalKeyPolicy,
            ...(input.trustedCis8 ===
                undefined
                ? {}
                : {
                    trustedCis8: input.trustedCis8,
                }),
            ...(input.cis8Transport ===
                undefined
                ? {}
                : {
                    transport: input.cis8Transport,
                }),
        });
    }
    catch {
        return buildResult({
            status: "denied",
            reason: "agent_registry_key_binding_exception",
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            registryReadCaptured: true,
        });
    }
    if (binding.ok !==
        true ||
        binding.status !==
            "accepted") {
        return buildResult({
            status: "denied",
            reason: binding.reason,
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            binding,
            registryReadCaptured: true,
        });
    }
    let card: AgentRegistryCardCapabilityFreshnessResultV1;
    try {
        card = await verifyAgentRegistryCardCapabilityFreshnessV1({
            requirement,
            identityKeyBindingResult: binding,
            registryTrustResult: resolver.trustResult,
            capabilityRules: input.capabilityRules,
            now: decidedAt,
            ...(input.agentCardTransport ===
                undefined
                ? {}
                : {
                    transport: input.agentCardTransport,
                }),
            ...(input.maxAgentCardBytes ===
                undefined
                ? {}
                : {
                    maxAgentCardBytes: input.maxAgentCardBytes,
                }),
            ...(input.agentCardFetchTimeoutMs ===
                undefined
                ? {}
                : {
                    fetchTimeoutMs: input.agentCardFetchTimeoutMs,
                }),
        });
    }
    catch {
        return buildResult({
            status: "denied",
            reason: "agent_registry_card_verification_exception",
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            binding,
            registryReadCaptured: true,
        });
    }
    if (card.status ===
        "revalidation_required") {
        return buildResult({
            status: "revalidation_required",
            reason: card.reason,
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            binding,
            card,
            registryReadCaptured: true,
        });
    }
    if (card.ok !==
        true ||
        card.status !==
            "accepted") {
        return buildResult({
            status: "denied",
            reason: card.reason,
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            binding,
            card,
            registryReadCaptured: true,
        });
    }
    const evidence = sanitizedEvidence(resolver, binding, card);
    const handoff = paymentEligibilityHandoff(preflight, decidedAt, evidence);
    if (handoff ===
        null) {
        return buildResult({
            status: "denied",
            reason: "authorization_evidence_incomplete",
            decidedAt,
            phase5PreflightAccepted: true,
            resolver,
            binding,
            card,
            registryReadCaptured: true,
        });
    }
    return buildResult({
        status: "allowed",
        reason: "accepted",
        decidedAt,
        phase5PreflightAccepted: true,
        resolver,
        binding,
        card,
        handoff,
        registryReadCaptured: true,
    });
}
