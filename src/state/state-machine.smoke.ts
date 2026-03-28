import {
  PAYMENT_STATES,
  canTransition,
  transitionPaymentState,
  getInitialPaymentState,
} from "./index";

function main(): void {
  let state = getInitialPaymentState();
  console.log("initial:", state);

  const path = [
    PAYMENT_STATES.PROOF_SUBMITTED,
    PAYMENT_STATES.SOURCE_VERIFY_PENDING,
    PAYMENT_STATES.SOURCE_VERIFIED,
    PAYMENT_STATES.POLICY_SATISFIED,
    PAYMENT_STATES.SETTLEMENT_REQUESTED,
    PAYMENT_STATES.SETTLEMENT_PENDING,
    PAYMENT_STATES.SETTLEMENT_CONFIRMED,
    PAYMENT_STATES.RELEASED,
  ];

  for (const next of path) {
    console.log(`canTransition(${state}, ${next}) =`, canTransition(state, next));
    state = transitionPaymentState(state, next, { actor: "smoke" });
    console.log("now:", state);
  }
}

main();
