# Milestone 0 — Baseline Freeze

Date: 2026-03-09

Repository: payfi-gateway-demo

Baseline Commit:
ab43b58c4917677fe40c1ed553b8360175753807

Architecture:
Single-chain Concordium x402 payment flow.

Components:
- x402 Proxy Gateway
- XCF/CRP facilitator
- Concordium Testnet
- Merchant wallet receives PLT
- Resource released after successful native settlement

Invariants:
- Native Concordium path unchanged
- No Faremeter integration yet
- No Corbits integration yet

This commit freezes the working baseline before multi-client work begins.
