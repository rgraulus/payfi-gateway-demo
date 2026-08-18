#!/usr/bin/env ts-node
/**
 * PLT transfer helper (service perspective) for autorun E2E.
 *
 * - Works in a CommonJS ts-node project even though @concordium/web-sdk is ESM-only:
 *   uses dynamic import() after parsing args.
 * - Prints ONLY the tx hash to stdout (machine-friendly).
 * - Logs human/debug output to stderr.
 *
 * Based on Concordium docs:
 * https://docs.concordium.com/en/mainnet/docs/plt/examples/web-sdk.html#transfer-tokens
 */

import { existsSync, readFileSync } from "node:fs";

type Args = Record<string, string | boolean>;

function usage(exitCode = 0): never {
  const msg = `
Usage:
  npm run payer:plt -- --wallet keys/wallet.export --to <ACCOUNT_ADDRESS> --tokenId EUDemo --amount 0.050101

Required:
  --wallet <path>     Path to wallet.export (parseWallet)
  --to <address>      Recipient account address (base58)
  --tokenId <id>      TokenId (e.g., EUDemo)
  --amount <decimal>  Amount as decimal string (e.g., 0.050101)

Optional:
  --grpcHost <host>   Default: grpc.testnet.concordium.com
  --grpcPort <port>   Default: 20000
  --memo <string>     Optional memo (best-effort; not used for correlation)
  --wait              Wait for finalization (default)
  --no-wait           Do NOT wait for finalization
  --help              Show help

Output:
  Prints the submitted transaction hash to stdout.
`;
  console.error(msg.trim() + "\n");
  process.exit(exitCode);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    if (key === "help") out.help = true;
    else if (key === "wait") out.wait = true;
    else if (key === "no-wait") out["no-wait"] = true;
    else {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = v;
        i++;
      }
    }
  }
  return out;
}

function reqStr(args: Args, k: string): string {
  const v = args[k];
  if (typeof v !== "string" || v.length === 0) {
    console.error(`ERROR: missing required --${k}`);
    usage(2);
  }
  return v;
}

export type PltTransferPreflightInputV1 = {
  readonly walletPath: string;
  readonly to: string;
  readonly tokenId: string;
  readonly amount: string;
  readonly grpcHost?: string;
  readonly grpcPort?: number;
  readonly memo?: string;
};

export type PltTransferPreparedV1 = {
  readonly walletPath: string;
  readonly to: string;
  readonly tokenId: string;
  readonly amount: string;
  readonly grpcHost: string;
  readonly grpcPort: number;
  readonly senderAddress: string;
  readonly decimals: number;
  readonly walletReadCount: 1;
  readonly tokenNetworkReads: 1;
  readonly accountInfoNetworkReads: 1;
  readonly payerTokenBalanceRaw: string;
  readonly requiredAmountRaw: string;
  readonly balanceSufficient: true;
  readonly transactionConstructed: false;
  readonly transactionSubmitted: false;

  /*
   * Opaque in-memory execution material.
   *
   * It is deliberately never serialized or printed. Keeping this material
   * in-memory allows preflight + one-shot invocation to share the single
   * wallet-file read when executed in one controlled process.
   */
  readonly runtime: {
    readonly webSdk: any;
    readonly pltSdk: any;
    readonly client: any;
    readonly walletExport: any;
    readonly sender: any;
    readonly token: any;
    readonly amountValue: any;
    readonly recipient: any;
    readonly memo: unknown;
  };
};

export type PltTransferBalanceReadinessV1 = {
  readonly ok: boolean;

  readonly reason:
    | "plt_payer_balance_ready"
    | "plt_payer_balance_decimals_mismatch"
    | "plt_payer_balance_insufficient";

  readonly payerTokenBalanceRaw: string;
  readonly requiredAmountRaw: string;
  readonly decimals: number;
};

export function assessPltTransferBalanceReadinessV1(
  input: {
    readonly payerTokenBalanceRaw: bigint;
    readonly payerTokenBalanceDecimals: number;
    readonly requiredAmountRaw: bigint;
    readonly requiredAmountDecimals: number;
  },
): PltTransferBalanceReadinessV1 {
  if (
    input.payerTokenBalanceDecimals !==
      input.requiredAmountDecimals
  ) {
    return {
      ok:
        false,

      reason:
        "plt_payer_balance_decimals_mismatch",

      payerTokenBalanceRaw:
        input.payerTokenBalanceRaw.toString(),

      requiredAmountRaw:
        input.requiredAmountRaw.toString(),

      decimals:
        input.requiredAmountDecimals,
    };
  }

  if (
    input.payerTokenBalanceRaw <
      input.requiredAmountRaw
  ) {
    return {
      ok:
        false,

      reason:
        "plt_payer_balance_insufficient",

      payerTokenBalanceRaw:
        input.payerTokenBalanceRaw.toString(),

      requiredAmountRaw:
        input.requiredAmountRaw.toString(),

      decimals:
        input.requiredAmountDecimals,
    };
  }

  return {
    ok:
      true,

    reason:
      "plt_payer_balance_ready",

    payerTokenBalanceRaw:
      input.payerTokenBalanceRaw.toString(),

    requiredAmountRaw:
      input.requiredAmountRaw.toString(),

    decimals:
      input.requiredAmountDecimals,
  };
}

export type PltTransferExecutionOutcomeV1 =
  | "finalized_success"
  | "finalized_failure"
  | "submitted_unknown";

export type PltTransferExecutionResultV1 = {
  readonly ok: boolean;
  readonly outcome: PltTransferExecutionOutcomeV1;
  readonly txHash: string | null;
  readonly transactionHashObserved: boolean;
  readonly paymentSubmissionAttempts: 1;
  readonly signingOperations: 1;
  readonly transactionsConstructed: 1;
  readonly automaticRetry: false;
  readonly finalized: boolean;
  readonly diagnostic: string | null;
};

function pltExecutionResult(
  ok: boolean,
  outcome: PltTransferExecutionOutcomeV1,
  txHash: string | null,
  finalized: boolean,
  diagnostic: string | null,
): PltTransferExecutionResultV1 {
  return {
    ok,
    outcome,
    txHash,
    transactionHashObserved:
      typeof txHash === "string" &&
      txHash.length > 0,
    paymentSubmissionAttempts: 1,
    signingOperations: 1,
    transactionsConstructed: 1,
    automaticRetry: false,
    finalized,
    diagnostic,
  };
}

export async function preflightPltTransferV1(
  input: PltTransferPreflightInputV1,
): Promise<PltTransferPreparedV1> {
  const walletPath = input.walletPath;
  const toAddr = input.to;
  const tokenIdStr = input.tokenId;
  const amountStr = input.amount;

  if (
    typeof walletPath !== "string" ||
    walletPath.length === 0
  ) {
    throw new Error(
      "plt_payer_wallet_path_invalid",
    );
  }

  if (!existsSync(walletPath)) {
    throw new Error(
      "plt_payer_wallet_file_not_found",
    );
  }

  if (
    typeof toAddr !== "string" ||
    toAddr.length === 0 ||
    typeof tokenIdStr !== "string" ||
    tokenIdStr.length === 0 ||
    typeof amountStr !== "string" ||
    amountStr.length === 0
  ) {
    throw new Error(
      "plt_payer_transfer_tuple_invalid",
    );
  }

  const grpcHost =
    input.grpcHost ??
    "grpc.testnet.concordium.com";

  const grpcPort =
    input.grpcPort ??
    20000;

  if (
    !Number.isSafeInteger(grpcPort) ||
    grpcPort <= 0
  ) {
    throw new Error(
      "plt_payer_grpc_port_invalid",
    );
  }

  const webSdk =
    await import(
      "@concordium/web-sdk"
    );

  const pltSdk =
    await import(
      "@concordium/web-sdk/plt"
    );

  const nodeSdk =
    await import(
      "@concordium/web-sdk/nodejs"
    );

  const grpc =
    await import(
      "@grpc/grpc-js"
    );

  const {
    AccountAddress,
    parseWallet,
  } = webSdk;

  const {
    TokenId,
    TokenAmount,
    Token,
    TokenHolder,
  } = pltSdk;

  const {
    ConcordiumGRPCNodeClient,
  } = nodeSdk;

  const {
    credentials,
  } = grpc;

  const client =
    new ConcordiumGRPCNodeClient(
      grpcHost,
      grpcPort,
      credentials.createSsl(),
    );

  /*
   * Exactly one wallet-file read occurs here.
   * No signer is created and no transfer is invoked during preflight.
   */
  const walletFile =
    readFileSync(
      walletPath,
      "utf8",
    );

  const walletExport =
    parseWallet(
      walletFile,
    );

  const sender =
    AccountAddress.fromBase58(
      walletExport.value.address,
    );

  const tokenId =
    TokenId.fromString(
      tokenIdStr,
    );

  /*
   * Read-only chain lookup: resolve canonical token decimals.
   */
  const token =
    await Token.fromId(
      client,
      tokenId,
    );

  const decimals =
    token.info.state.decimals;

  const amountValue =
    TokenAmount.fromDecimal(
      amountStr,
      decimals,
    );

  /*
   * Read-only finalized account lookup. This proves that the payer account
   * actually holds enough of the requested PLT before any signer exists.
   */
  const accountInfo =
    await client
      .getAccountInfo(
        sender,
      );

  /*
   * The AccountInfo overload is a local extraction from the account state
   * already returned above; it does not perform an additional network call.
   */
  const payerTokenBalance =
    pltSdk.Token.balanceOf(
      token,
      accountInfo,
    );

  if (!payerTokenBalance) {
    throw new Error(
      "plt_payer_token_balance_not_found",
    );
  }

  const balanceReadiness =
    assessPltTransferBalanceReadinessV1({
      payerTokenBalanceRaw:
        payerTokenBalance.value,

      payerTokenBalanceDecimals:
        payerTokenBalance.decimals,

      requiredAmountRaw:
        amountValue.value,

      requiredAmountDecimals:
        amountValue.decimals,
    });

  if (!balanceReadiness.ok) {
    throw new Error(
      balanceReadiness.reason,
    );
  }

  const recipient =
    TokenHolder
      .fromAccountAddress(
        AccountAddress.fromBase58(
          toAddr,
        ),
      )
      .address;

  let memo:
    unknown =
    undefined;

  if (input.memo) {
    const maybeCborMemo =
      (pltSdk as any).CborMemo;

    if (
      maybeCborMemo &&
      typeof maybeCborMemo.fromString ===
        "function"
    ) {
      memo =
        maybeCborMemo.fromString(
          input.memo,
        );
    }
  }

  return {
    walletPath,
    to:
      toAddr,
    tokenId:
      tokenIdStr,
    amount:
      amountStr,
    grpcHost,
    grpcPort,
    senderAddress:
      walletExport.value.address,
    decimals,
    walletReadCount:
      1,
    tokenNetworkReads:
      1,
    accountInfoNetworkReads:
      1,
    payerTokenBalanceRaw:
      balanceReadiness.payerTokenBalanceRaw,
    requiredAmountRaw:
      balanceReadiness.requiredAmountRaw,
    balanceSufficient:
      true,
    transactionConstructed:
      false,
    transactionSubmitted:
      false,
    runtime: {
      webSdk,
      pltSdk,
      client,
      walletExport,
      sender,
      token,
      amountValue,
      recipient,
      memo,
    },
  };
}

export async function executePreparedPltTransferV1(
  input: {
    readonly prepared:
      PltTransferPreparedV1;
    readonly waitForFinalization?:
      boolean;
    readonly onSubmitted?:
      (
        txHash:
          string,
      ) => void;
  },
): Promise<PltTransferExecutionResultV1> {
  const prepared =
    input.prepared;

  const waitForFinalization =
    input.waitForFinalization !==
      false;

  const {
    webSdk,
    pltSdk,
    client,
    walletExport,
    sender,
    token,
    amountValue,
    recipient,
    memo,
  } =
    prepared.runtime;

  /*
   * Payment-attempt accounting belongs to the caller and must be consumed
   * before this function is invoked. This function itself never retries.
   */
  const signer =
    webSdk.buildAccountSigner(
      walletExport,
    );

  const transfer:
    any = {
      recipient,
      amount:
        amountValue,
      memo,
    };

  let txHash:
    string |
    null =
    null;

  try {
    const submittedHash =
      await pltSdk.Token.transfer(
        token,
        sender,
        transfer,
        signer,
      );

    txHash =
      String(
        submittedHash,
      );

    input.onSubmitted?.(
      txHash,
    );
  } catch {
    return pltExecutionResult(
      false,
      "submitted_unknown",
      null,
      false,
      "plt_transfer_invocation_outcome_ambiguous",
    );
  }

  if (!waitForFinalization) {
    return pltExecutionResult(
      true,
      "submitted_unknown",
      txHash,
      false,
      "plt_transfer_submitted_finalization_not_requested",
    );
  }

  let result:
    any;

  try {
    result =
      await client
        .waitForTransactionFinalization(
          txHash,
        );
  } catch {
    return pltExecutionResult(
      false,
      "submitted_unknown",
      txHash,
      false,
      "plt_transfer_finalization_outcome_ambiguous",
    );
  }

  if (
    !webSdk.isKnown(
      result.summary,
    )
  ) {
    return pltExecutionResult(
      false,
      "submitted_unknown",
      txHash,
      false,
      "plt_transfer_unknown_transaction_summary",
    );
  }

  if (
    result.summary.type !==
      webSdk.TransactionSummaryType
        .AccountTransaction
  ) {
    return pltExecutionResult(
      false,
      "submitted_unknown",
      txHash,
      false,
      "plt_transfer_unexpected_summary_type",
    );
  }

  switch (
    result.summary.transactionType
  ) {
    case webSdk
      .TransactionKindString
      .TokenUpdate:
      return pltExecutionResult(
        true,
        "finalized_success",
        txHash,
        true,
        null,
      );

    case webSdk
      .TransactionKindString
      .Failed:
      return pltExecutionResult(
        false,
        "finalized_failure",
        txHash,
        true,
        "plt_transfer_finalized_failed",
      );

    default:
      return pltExecutionResult(
        false,
        "submitted_unknown",
        txHash,
        true,
        "plt_transfer_unexpected_transaction_kind",
      );
  }
}

async function main() {
  const args =
    parseArgs(
      process.argv.slice(2),
    );

  if (args.help) {
    usage(0);
  }

  const walletPath =
    reqStr(
      args,
      "wallet",
    );

  const toAddr =
    reqStr(
      args,
      "to",
    );

  const tokenIdStr =
    reqStr(
      args,
      "tokenId",
    );

  const amountStr =
    reqStr(
      args,
      "amount",
    );

  const grpcHost =
    (
      args.grpcHost as
        string
    ) ||
    "grpc.testnet.concordium.com";

  const grpcPort =
    Number(
      (
        args.grpcPort as
          string
      ) ||
      "20000",
    );

  const wait =
    args["no-wait"] ===
      true
      ? false
      : true;

  const memoStr =
    typeof args.memo ===
      "string"
      ? args.memo as
          string
      : undefined;

  /*
   * Preserve the historical CLI error contract for a missing wallet.
   */
  if (!existsSync(walletPath)) {
    console.error(
      `ERROR: wallet file not found: ${walletPath}`,
    );

    process.exit(2);
  }

  const prepared =
    await preflightPltTransferV1({
      walletPath,
      to:
        toAddr,
      tokenId:
        tokenIdStr,
      amount:
        amountStr,
      grpcHost,
      grpcPort,
      memo:
        memoStr,
    });

  console.error(
    `[payer:plt] tokenId=${prepared.tokenId} decimals=${prepared.decimals} amount=${prepared.amount} to=${prepared.to} sender=${prepared.senderAddress} wait=${wait}`,
  );

  const execution =
    await executePreparedPltTransferV1({
      prepared,
      waitForFinalization:
        wait,

      onSubmitted:
        (
          txHash,
        ) => {
          /*
           * Preserve machine-friendly CLI behavior:
           * stdout receives only the submitted transaction hash.
           */
          process.stdout.write(
            String(
              txHash,
            ) +
              "\n",
          );
        },
    });

  if (
    !wait &&
    execution
      .transactionHashObserved
  ) {
    return;
  }

  if (
    execution.outcome ===
      "finalized_success"
  ) {
    console.error(
      "[payer:plt] finalized: TokenUpdate",
    );

    return;
  }

  if (
    execution.outcome ===
      "finalized_failure"
  ) {
    console.error(
      "[payer:plt] finalized: FAILED",
    );
  } else {
    console.error(
      `ERROR: ${execution.diagnostic ?? "plt_transfer_outcome_unknown"}`,
    );
  }

  process.exit(1);
}

if (require.main === module) {
  void main().catch(
    (
      e,
    ) => {
      console.error(
        "ERROR:",
        e?.stack ||
          e,
      );

      process.exit(1);
    },
  );
}
