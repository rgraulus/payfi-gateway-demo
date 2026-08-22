import {
  executeDemo4D43PayerWalletPreflightV1,
  executeDemo4D43PaymentInvocationV1,
} from "./demo_phase6_demo4_d4_3_final_controlled_acceptance";

const CONTRACT = "demo4.final.payer-continuation.v1";
const MODE = process.env.DEMO4_FINAL_PAYER_CONTINUATION_MODE ?? "inspect";

function envTrue(name: string): boolean {
  return String(process.env[name] ?? "").toLowerCase() === "true";
}

function envString(name: string): string {
  return String(process.env[name] ?? "");
}

function printStatic(): void {
  console.log(`CONTINUATION_CONTRACT=${CONTRACT}`);
  console.log(`CONTINUATION_MODE=${MODE}`);
  console.log("PAYMENT_NETWORK=concordium:testnet");
  console.log("PAYMENT_CHAIN_ID=ccd:4221332d34e1694168c2a0c0b3fd0f27");
  console.log("PAYMENT_NETWORK_GENESIS_INDEX=7");
  console.log("PAYMENT_TOKEN_ID=EUDemo");
  console.log("PAYMENT_AMOUNT=0.050101");
  console.log("PAYMENT_AMOUNT_RAW=50101");
  console.log("MAX_PAYMENT_SUBMISSIONS=1");
  console.log("AUTOMATIC_RETRY=false");
  console.log("PREFLIGHT_AND_PAYMENT_SAME_PROCESS=true");
  console.log("OPAQUE_PREPARED_RUNTIME_SERIALIZED=false");
  console.log("PRODUCTION_ACTIVATION=false");
}

function printNoExecution(): void {
  console.log("CONTINUATION_EXECUTED=false");
  console.log("PAYER_WALLET_READ=false");
  console.log("TOKEN_NETWORK_READ=false");
  console.log("ACCOUNT_INFO_NETWORK_READ=false");
  console.log("TRANSACTION_CONSTRUCTED=false");
  console.log("TRANSACTION_SUBMITTED=false");
  console.log("PAYMENT_ATTEMPTED=false");
  console.log("CRP_FULFILL_CALLED=false");
  console.log("RESOURCE_RELEASED=false");
  console.log("REPLAY_PROBED=false");
}

async function main(): Promise<void> {
  printStatic();

  if (MODE === "inspect") {
    console.log("EXECUTION_AUTHORIZATION_REQUIRED=true");
    printNoExecution();
    console.log("RUNNER_RESULT=DEMO4_FINAL_PAYER_CONTINUATION_CONTRACT_READY");
    return;
  }

  if (MODE !== "execute") {
    printNoExecution();
    console.log("RUNNER_RESULT=BLOCKED_UNSUPPORTED_MODE");
    process.exitCode = 2;
    return;
  }

  if (!envTrue("DEMO4_FINAL_PAYER_CONTINUATION_AUTHORIZED")) {
    console.log("EXECUTION_AUTHORIZATION_REQUIRED=true");
    printNoExecution();
    console.log("RUNNER_RESULT=BLOCKED_CONTINUATION_NOT_AUTHORIZED");
    process.exitCode = 2;
    return;
  }

  const nonce = envString("DEMO4_FINAL_PAYER_NONCE");
  const expiresAt = Number(envString("DEMO4_FINAL_PAYER_EXPIRES_AT"));
  const contractId = envString("DEMO4_FINAL_PAYER_CONTRACT_ID");
  const contractVersion = envString("DEMO4_FINAL_PAYER_CONTRACT_VERSION");

  if (
    nonce.length === 0 ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= 0 ||
    contractId.length === 0 ||
    contractVersion !== "1.0.0" ||
    !envTrue("DEMO4_FINAL_PAYER_CRP_PENDING_REGISTERED")
  ) {
    printNoExecution();
    console.log("RUNNER_RESULT=BLOCKED_HANDOFF_CONTRACT_MISMATCH");
    process.exitCode = 3;
    return;
  }

  const paymentRequired = {
    nonce,
    expiresAt,
    merchantId: "demo-merchant",
    network: "concordium:testnet",
    chain_id: "ccd:4221332d34e1694168c2a0c0b3fd0f27",
    asset: {
      type: "PLT",
      tokenId: "EUDemo",
      decimals: 6,
    },
    amount: "0.050101",
    payTo: "4jPLfUuSeFeP5SFLrf2eDeZEnT7ixbqXyQp9bg6qrgXyHReDfZ",
    contractId,
    contractVersion,
    isFrozen: true,
    resource: {
      method: "GET",
      path: "/paid-gated",
    },
  };

  const preflight =
    await executeDemo4D43PayerWalletPreflightV1({
      crpPendingRegistered: true,
      paymentRequired,
    });

  console.log(`PAYER_PREFLIGHT_OK=${preflight.evidence.ok}`);
  console.log(`PAYER_PREFLIGHT_REASON=${preflight.evidence.reason}`);
  console.log(`PAYER_WALLET_READ=${preflight.evidence.walletReadCount === 1}`);
  console.log(`TOKEN_NETWORK_READ=${preflight.evidence.tokenNetworkReads === 1}`);
  console.log(`ACCOUNT_INFO_NETWORK_READ=${preflight.evidence.accountInfoNetworkReads === 1}`);
  console.log(`PAYER_BALANCE_SUFFICIENT=${preflight.evidence.balanceSufficient === true}`);
  console.log("TRANSACTION_CONSTRUCTED=false");
  console.log("TRANSACTION_SUBMITTED=false");
  console.log("PAYMENT_ATTEMPTED=false");

  if (!preflight.evidence.ok || preflight.prepared === null) {
    console.log("CRP_FULFILL_CALLED=false");
    console.log("RESOURCE_RELEASED=false");
    console.log("REPLAY_PROBED=false");
    console.log("RUNNER_RESULT=STOP_PAYER_PREFLIGHT_NOT_READY");
    process.exitCode = 4;
    return;
  }

  const payment =
    await executeDemo4D43PaymentInvocationV1({
      preflightSession: preflight,
    });

  console.log("CONTINUATION_EXECUTED=true");
  console.log(`PAYMENT_INVOCATION_OK=${payment.ok}`);
  console.log(`PAYMENT_INVOCATION_REASON=${payment.reason}`);
  console.log(`PAYMENT_SUBMISSION_ATTEMPTS=${payment.paymentSubmissionAttempts}`);
  console.log(`SIGNING_OPERATIONS=${payment.signingOperations}`);
  console.log(`TRANSACTIONS_CONSTRUCTED=${payment.transactionsConstructed}`);
  console.log(`TRANSACTION_SUBMITTED=${payment.paymentSubmissionAttempts === 1}`);
  console.log(`PAYMENT_ATTEMPTED=${payment.paymentSubmissionAttempts === 1}`);
  console.log(`TRANSACTION_HASH_PRESENT=${payment.transactionHashObserved}`);
  console.log(`TRANSACTION_HASH=${payment.transactionHash ?? ""}`);
  console.log(`PAYMENT_OUTCOME=${payment.paymentOutcome}`);
  console.log(`PAYMENT_FINALIZED=${payment.paymentFinalized}`);
  console.log(`STOP_REQUIRED=${payment.stopRequired}`);
  console.log("CRP_FULFILL_CALLED=false");
  console.log("RESOURCE_RELEASED=false");
  console.log("REPLAY_PROBED=false");

  if (!payment.ok || payment.paymentOutcome !== "finalized_success") {
    console.log("RUNNER_RESULT=STOP_PAYMENT_NOT_FINALIZED_SUCCESS");
    process.exitCode = 5;
    return;
  }

  console.log("RUNNER_RESULT=DEMO4_FINAL_PAYER_PAYMENT_FINALIZED");
}

void main().catch((error: unknown) => {
  const reason =
    error instanceof Error
      ? error.message
      : "unknown_error";

  console.error(`RUNNER_ERROR=${reason}`);
  process.exitCode = 1;
});
