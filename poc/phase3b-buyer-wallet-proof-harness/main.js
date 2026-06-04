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

  account =
    typeof mostRecent === 'string'
      ? mostRecent
      : Array.isArray(accounts) && typeof accounts[0] === 'string'
        ? accounts[0]
        : null;

  setState({
    ok: true,
    step: 'account_connected',
    accounts,
    account,
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
