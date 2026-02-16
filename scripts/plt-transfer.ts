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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage(0);

  const walletPath = reqStr(args, "wallet");
  const toAddr = reqStr(args, "to");
  const tokenIdStr = reqStr(args, "tokenId");
  const amountStr = reqStr(args, "amount");

  const grpcHost = (args.grpcHost as string) || "grpc.testnet.concordium.com";
  const grpcPort = Number((args.grpcPort as string) || "20000");

  const wait =
    args["no-wait"] === true ? false : true; // default wait=true
  const memoStr = typeof args.memo === "string" ? (args.memo as string) : undefined;

  if (!existsSync(walletPath)) {
    console.error(`ERROR: wallet file not found: ${walletPath}`);
    process.exit(2);
  }

  // ---- Dynamic ESM imports (fix for TS1479 in ts-node CommonJS) ----
  const webSdk = await import("@concordium/web-sdk");
  const pltSdk = await import("@concordium/web-sdk/plt");
  const nodeSdk = await import("@concordium/web-sdk/nodejs");
  const grpc = await import("@grpc/grpc-js");

  const {
    AccountAddress,
    parseWallet,
    buildAccountSigner,
    isKnown,
    TransactionSummaryType,
    TransactionKindString,
    RejectReasonTag,
  } = webSdk;

  const { TokenId, TokenAmount, Token, TokenHolder, Cbor } = pltSdk;
  const { ConcordiumGRPCNodeClient } = nodeSdk;
  const { credentials } = grpc;

  const client = new ConcordiumGRPCNodeClient(grpcHost, grpcPort, credentials.createSsl());

  const walletFile = readFileSync(walletPath, "utf8");
  const walletExport = parseWallet(walletFile);
  const sender = AccountAddress.fromBase58(walletExport.value.address);
  const signer = buildAccountSigner(walletExport);

  const tokenId = TokenId.fromString(tokenIdStr);

  // Resolve token decimals from chain, then compute raw amount correctly.
  const token = await Token.fromId(client, tokenId);
  const decimals = token.info.state.decimals;

  const amount = TokenAmount.fromDecimal(amountStr, decimals);
  const recipient = TokenHolder.fromAccountAddress(AccountAddress.fromBase58(toAddr)).address;

  // Memo is optional and best-effort. The docs show CborMemo.fromString, but don’t import it explicitly.
  // We’ll only set it if the runtime exposes it.
  let memo: unknown = undefined;
  if (memoStr) {
    const maybeCborMemo = (pltSdk as any).CborMemo;
    if (maybeCborMemo && typeof maybeCborMemo.fromString === "function") {
      memo = maybeCborMemo.fromString(memoStr);
    } else {
      // Don’t fail the payment if memo support isn’t present.
      console.error("WARN: memo requested but CborMemo.fromString not available in this SDK build; skipping memo.");
    }
  }

  const transfer: any = { recipient, amount, memo };

  console.error(
    `[payer:plt] tokenId=${tokenIdStr} decimals=${decimals} amount=${amountStr} to=${toAddr} sender=${walletExport.value.address} wait=${wait}`
  );

  const txHash = await Token.transfer(token, sender, transfer, signer);

  // Machine-friendly: stdout gets ONLY the hash
  process.stdout.write(String(txHash) + "\n");

  if (!wait) return;

  const result = await client.waitForTransactionFinalization(txHash);

  if (!isKnown(result.summary)) {
    console.error("ERROR: unexpected transaction outcome (unknown summary)");
    process.exit(1);
  }
  if (result.summary.type !== TransactionSummaryType.AccountTransaction) {
    console.error(`ERROR: unexpected summary type: ${result.summary.type}`);
    process.exit(1);
  }

  switch (result.summary.transactionType) {
    case TransactionKindString.TokenUpdate:
      console.error("[payer:plt] finalized: TokenUpdate");
      break;
    case TransactionKindString.Failed: {
      console.error("[payer:plt] finalized: FAILED");
      if (result.summary.rejectReason?.tag === RejectReasonTag.TokenUpdateTransactionFailed) {
        const details = Cbor.decode(result.summary.rejectReason.contents.details);
        console.error(result.summary.rejectReason.contents, details);
      } else {
        console.error(result.summary.rejectReason);
      }
      process.exit(1);
      break;
    }
    default:
      console.error(`ERROR: unexpected transaction kind: ${result.summary.transactionType}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e?.stack || e);
  process.exit(1);
});
