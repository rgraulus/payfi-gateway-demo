import {
  PAYMENT_STATES,
  isActivePaymentState,
  isTerminalPaymentState,
  type PaymentState,
} from "./payment-state";
import { getAllowedTransitions } from "./transition-rules";

export interface TransitionContext {
  actor?: string;
  reasonCode?: string;
  reasonMessage?: string;
}

export class InvalidStateTransitionError extends Error {
  public readonly from: PaymentState;
  public readonly to: PaymentState;
  public readonly actor?: string;
  public readonly reasonCode?: string;

  constructor(from: PaymentState, to: PaymentState, context?: TransitionContext) {
    super(
      `Invalid payment state transition: ${from} -> ${to}` +
        (context?.actor ? ` (actor=${context.actor})` : ""),
    );
    this.name = "InvalidStateTransitionError";
    this.from = from;
    this.to = to;
    this.actor = context?.actor;
    this.reasonCode = context?.reasonCode;
  }
}

export function getInitialPaymentState(): PaymentState {
  return PAYMENT_STATES.ISSUED;
}

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return getAllowedTransitions(from).has(to);
}

export function assertCanTransition(
  from: PaymentState,
  to: PaymentState,
  context?: TransitionContext,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(from, to, context);
  }
}

export function transitionPaymentState(
  current: PaymentState,
  next: PaymentState,
  context?: TransitionContext,
): PaymentState {
  assertCanTransition(current, next, context);
  return next;
}

export function isTerminalState(state: PaymentState): boolean {
  return isTerminalPaymentState(state);
}

export function isActiveState(state: PaymentState): boolean {
  return isActivePaymentState(state);
}

export function requiresPolicyEvaluation(state: PaymentState): boolean {
  return state === PAYMENT_STATES.SOURCE_VERIFIED;
}

export function canAttemptRelease(state: PaymentState): boolean {
  return state === PAYMENT_STATES.SETTLEMENT_CONFIRMED;
}
