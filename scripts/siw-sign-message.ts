import { existsSync, readFileSync } from "fs";

function usage(): never {
  console.error(
    "Usage: ts-node scripts/siw-sign-message.ts --wallet <wallet-export.json> --message-file <message.txt>"
  );
  process.exit(2);
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const walletPath = getArg("--wallet");
  const messageFile = getArg("--message-file");

  if (!walletPath || !messageFile) usage();

  if (!existsSync(walletPath)) {
    console.error(`ERROR: wallet file not found: ${walletPath}`);
    process.exit(2);
  }
  if (!existsSync(messageFile)) {
    console.error(`ERROR: message file not found: ${messageFile}`);
    process.exit(2);
  }

  // Dynamic ESM import pattern already used in this repo.
  const webSdk = await import("@concordium/web-sdk");

  const {
    AccountAddress,
    parseWallet,
    buildAccountSigner,
    signMessage,
  } = webSdk as any;

  const walletFile = readFileSync(walletPath, "utf8");
  const walletExport = parseWallet(walletFile);

  const accountAddress = AccountAddress.fromBase58(walletExport.value.address);
  const signer = buildAccountSigner(walletExport);

  const message = readFileSync(messageFile, "utf8");

  const signature = await signMessage(accountAddress, message, signer);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        accountAddress: walletExport.value.address,
        message,
        signature,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((err) => {
  console.error(`ERROR: ${String((err as any)?.message ?? err)}`);
  process.exit(1);
});
