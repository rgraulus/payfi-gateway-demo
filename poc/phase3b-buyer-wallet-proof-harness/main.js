import { detectConcordiumProvider } from '@concordium/browser-wallet-api-helpers';
import { Web3StatementBuilder } from '@concordium/web-sdk';

let provider = null;
let account = null;
let selectedChain = null;
let lastPresentation = null;

const stateEl = document.getElementById('state');
const outputEl = document.getElementById('output');

function setState(value) {
  stateEl.textContent =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function setOutput(value) {
  outputEl.textContent =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function randomHex(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractAccountAddress(value) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractAccountAddress(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (isRecord(value)) {
    const directCandidates = [
      value.account,
      value.address,
      value.accountAddress,
      value.base58,
      value.value,
    ];

    for (const candidate of directCandidates) {
      const extracted = extractAccountAddress(candidate);
      if (extracted) return extracted;
    }

    return extractAccountAddress(value.accounts);
  }

  return null;
}

function summarizeAccountShape(value) {
  if (value === null || value === undefined) return 'missing';
  if (typeof value === 'string') return value.length > 0 ? 'string' : 'empty_string';
  if (Array.isArray(value)) return `array:${value.length}`;
  if (isRecord(value)) return `object:${Object.keys(value).sort().join(',')}`;
  return typeof value;
}

async function detectWallet() {
  provider = await detectConcordiumProvider(5000);
  selectedChain = await provider.getSelectedChain();

  setState({
    ok: true,
    step: 'wallet_detected',
    selectedChain,
    hasRequestVerifiablePresentation:
      typeof provider.requestVerifiablePresentation === 'function',
    hasRequestVerifiablePresentationV1:
      typeof provider.requestVerifiablePresentationV1 === 'function',
  });
}

async function connectAccount() {
  if (!provider) {
    await detectWallet();
  }

  const accounts = await provider.requestAccounts();
  const mostRecent = await provider.getMostRecentlySelectedAccount();

  account = extractAccountAddress(mostRecent) ?? extractAccountAddress(accounts);

  setState({
    ok: true,
    step: 'account_connected',
    account,
    accountPresent: typeof account === 'string' && account.length > 0,
    accountsShape: summarizeAccountShape(accounts),
    mostRecentShape: summarizeAccountShape(mostRecent),
    selectedChain: await provider.getSelectedChain(),
  });
}

function buildAgeEuStatement() {
  return new Web3StatementBuilder()
    .addForIdentityCredentials([0, 1, 2, 3, 4, 5], (builder) => {
      builder.addMinimumAge(18).addEUResidency();
    })
    .getStatements();
}

async function requestPresentation() {
  if (!provider) {
    await detectWallet();
  }

  if (!account) {
    await connectAccount();
  }

  const challenge = randomHex(32);
  const statements = buildAgeEuStatement();

  setState({
    ok: true,
    step: 'requesting_presentation',
    account,
    selectedChain: await provider.getSelectedChain(),
    challenge,
    statements,
  });

  lastPresentation = await provider.requestVerifiablePresentation(challenge, statements);

  setOutput({
    type: 'phase3b_browser_wallet_presentation_capture',
    capturedAt: new Date().toISOString(),
    warning:
      'Do not commit this proof artifact unless sanitized and explicitly approved.',
    account,
    accountPresent: typeof account === 'string' && account.length > 0,
    selectedChain: await provider.getSelectedChain(),
    challenge,
    statements,
    presentation: lastPresentation,
  });

  setState({
    ok: true,
    step: 'presentation_received',
    account,
    selectedChain: await provider.getSelectedChain(),
    challenge,
  });
}

async function copyOutput() {
  await navigator.clipboard.writeText(outputEl.textContent);
  setState({
    ok: true,
    step: 'output_copied',
    account,
    selectedChain,
  });
}

document.getElementById('detect').addEventListener('click', () => {
  detectWallet().catch((error) => {
    setState({ ok: false, step: 'wallet_detect_failed', error: String(error?.message ?? error) });
  });
});

document.getElementById('connect').addEventListener('click', () => {
  connectAccount().catch((error) => {
    setState({ ok: false, step: 'account_connect_failed', error: String(error?.message ?? error) });
  });
});

document.getElementById('proof').addEventListener('click', () => {
  requestPresentation().catch((error) => {
    setState({ ok: false, step: 'presentation_request_failed', error: String(error?.message ?? error) });
  });
});

document.getElementById('copy').addEventListener('click', () => {
  copyOutput().catch((error) => {
    setState({ ok: false, step: 'copy_failed', error: String(error?.message ?? error) });
  });
});
