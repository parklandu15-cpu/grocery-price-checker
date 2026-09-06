# Grocery Price Checker

Household grocery-comparison prototype for the Spruce Grove / Stony Plain area.

## What this repository is for

This repository is the permanent source copy of the Grocery Price Checker so hosting can be changed without losing the app.

Current goals:

- accept a weekly grocery list in plain language;
- compare practical one-store and two-store shopping plans;
- preserve household quantity, brand, size, and substitution rules;
- prefer local verified pricing and label regional fallback/proxy data;
- exclude suspicious matches and price anomalies instead of forcing a result;
- keep API keys and credentials out of source control.

## Household rules currently reflected

- Chicken breast: compare 2 kg, boneless/skinless.
- Bananas: compare 2 kg.
- Egg whites: preferred package size 500 g.
- No three-store recommendation in the household-facing output.
- A user-adjustable threshold determines whether the second stop is worth the savings.

## Store coverage

Current prototype logic covers:

- Real Canadian Superstore
- No Frills
- Walmart Canada
- Safeway Canada
- Sobeys

Costco is the next major store integration. Costco must compare both bulk-pack cash outlay and normalized unit price.

## Secrets

The real `VYNN_API_KEY` must be configured only in the hosting provider's environment variables. It must never be committed to GitHub.

## Snapshot note

This handoff package combines the latest recovered browser prototype with the most complete preserved backend adapter snapshot from the working session. It is intended to establish GitHub as the source of truth; the backend/hosting adapter can then be hardened and synchronized with the live prototype in subsequent commits.
