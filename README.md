# Xoay Vòng Tiến Lui

A single-player Vietnamese financial board game built with React, TypeScript and Vite. The deterministic engine runs entirely in browser memory; refreshing the page starts over.

## Run and verify

Verified with Node 22.14.0 and npm 10.9.2. The test and simulation scripts use Node's experimental TypeScript stripping:

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
npm run simulate:v2 -- 5000
```

The development URL defaults to http://localhost:5173. The simulation command generates `docs/V2_BALANCE_REPORT.md` and `docs/simulations/v2-results.json`: five strategies with 5,000 identical seeds each, plus six sensitivity runs with 5,000 seeds each (55,000 games total). Sensitivity variants affect only the simulation process and do not edit gameplay configuration. No deployment is required.

## Gameplay V2

Base rules are in [XVTL_GAME_SPEC_V2.md](docs/XVTL_GAME_SPEC_V2.md); new-game business income and purchase flow follow the approved [V2.4 update](docs/V2_4_BUSINESS_UX_REPORT.md). The primary Web MVP uses Experimental B: 50M VND, four laps on C20, and 4/5/6% simple savings rates for 1/2/3-START terms. Original (three laps, A20) and Experimental A remain available internally for historical replay and regression tests. Winning requires enough lawful proceeds to buy an 80M item and retain 10M after purchase. The calculation includes net sale quotes and redeemable savings principal, subtracts outstanding debt and obligations, and excludes unsold business capital.

- The data-driven 20-tile board has dedicated bank, stock, bond, gold, business, course, living expense, personal shock, macro and obligation tiles, plus START. Living expenses apply only on exact landing.
- START processes normal market changes, 14M salary (plus a purchased course's 3M increase), business cashflow, deposit maturities and bond schedules, then debt and obligations. A sell-only checkpoint follows every lap, including the last. Overshoot resolves after settlement and the next forecast; final-lap overshoot is discarded.
- A course costs 6M once per game and increases salary from the next START. Voluntary purchases require cash and the corresponding landed tile; START allows only financial asset sales and debt repayment.
- Savings are separate deposit lots with 1/2/3-lap terms and configurable simple interest. Maturity pays once. Mandatory funding may redeem a whole lot early, forfeiting its unpaid term interest; a late maturity is disclosed.
- Six fictional stocks in three sectors share deterministic market and sector movement plus individual variation. Twelve historical points use a separate RNG stream. Charts, trades and portfolio valuation use the same current price.
- Macro events immediately update stock, bond, gold and business state once. START compounds normal returns from those updated prices. Bonds have coupons and principal schedules; gold has a disclosed sale spread.
- New V2.4 games pay 3M per START plus 700k per upgrade and 1M per upgrade matching the current customer preference: check-in space, affordability or drink quality. Preferences come from a separate deterministic seed/lap source and stay fixed through each lap. Economic forecasts and shocks affect resale value, not operating income. Buying a business atomically ends its encounter; later Business encounters allow one upgrade and an eligible sale. V2.3 keeps scenario-based matching; V2.1/V2.2 retain their historical income formula. Unsold business capital remains risky and illiquid.
- Mandatory shortages let the player combine whole-lot savings withdrawals, financial asset sales and capped borrowing. Business cannot be sold through emergency funding. Exhausted sources end in explicit insolvency.

Economic parameters remain experimental and are centralized in `src/data/config.ts`. A lap is a game unit, not a real-world year. Companies, prices and histories are fictional; there is no live market data, backend, login, real AI or multiplayer.

## Structure

| Path | Purpose |
| --- | --- |
| `src/data/` | Configurable rules, board and event content |
| `src/game/engine.ts` | Seeded turns, encounters and phase transitions |
| `src/game/settlement.ts` | Resumable, once-only START processing |
| `src/game/transactions.ts` | Trading gates, deposits, quotes and funding |
| `src/game/market.ts`, `business.ts` | Market evolution and business cashflow |
| `src/game/selectors.ts`, `state.ts`, `log.ts` | Goal calculation, snapshots and JSON export |
| `src/components/` | Vietnamese board, dialogs, charts and portfolio UI |
| `tests/*.test.ts` | Engine, financial and V2 regression tests |
| `scripts/simulate-v2.ts` | Seeded strategy comparison and sensitivity analysis |

## Reproducibility and verification

The same seed and actions reproduce the same state and ordered logs. Viewing charts does not advance the future RNG. Schema 5 JSON exports contain the versioned savings profile, full state, before/after snapshots and lap summaries. Historical V2.1 profiles and replays remain supported. There is no UI import or automatic persistence. Browser JSON download and complete snapshot replay are verified.

Verification on 11 October 2026: 155/155 product tests, 19/19 behavior diagnostics, ESLint, TypeScript app/harness and production build passed. V2.4 browser checks cover 320/390/430/768/1024/1440px, including atomic business purchase, keyboard-accessible specialization choices, one upgrade and later sale. A complete four-lap C20 game included one purchase/upgrade/sale and three atomic stock purchases (25 rolls, 85,128,031 VND lawful proceeds); downloaded snapshots replay exactly and dice/RNG/movement match the V2.3 reference. A second game covers deposits on different Bank encounters (26 rolls, 103,921,205 VND). See the [V2.4 report](docs/V2_4_BUSINESS_UX_REPORT.md) and [browser evidence](docs/playtests/business-v2_4/preferences/verification.json). The old V2.2 artifact checksum verifier still reports a UI manifest mismatch; behavioral diagnostics pass.

Schema 5 declares independent income and encounter rules. New games use `businessRulesVersion: v2.4-customer-preferences`, `encounterRulesVersion: v2.4-business-purchase-complete` and a typed `customerPreferenceId` in state/snapshots. Missing historical metadata retains legacy rules. Existing `v2.3-fixed-income`, `v2.3-single-action` and old multi-action encounters remain replayable without reinterpreting their upgrade keys. Historical fixtures are unchanged.

Stock purchases still use `buy-stocks-complete`. Each Bank encounter permits one new deposit with atomic completion; different encounters retain independent lots/rates/maturities. New business purchases use one `buy-business` record whose versioned transition returns to rolling, with no Skip, upgrade or sale in that purchase encounter. Later encounters allow one upgrade and selling afterward. Bonds/gold trading, financial amounts, valuation, maturity and RNG are unchanged.

Additional checks:

```sh
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npx tsc -b
node --experimental-strip-types scripts/verify-mobile-ui.mjs
node --experimental-strip-types scripts/verify-transaction-inputs.mjs
node scripts/verify-business-purchase.mjs
node --experimental-strip-types scripts/verify-business-v2_4.mjs
```

The UI script needs a running Vite server and an existing Playwright installation with Chrome. Set `PLAYWRIGHT_MODULE` to its absolute module directory when using a bundled installation; `UI_URL` defaults to `http://localhost:5173`. No production dependency is added. The script saves screenshots, downloads a real browser log, replays every snapshot, and stores the verified log as gzip under `docs/playtests/business-v2_4/regression/` (the focused V2.4 script uses `docs/playtests/business-v2_4/preferences/`). Financial harness cases are explicitly synthetic and development-only.

See the Vietnamese [implementation report](docs/V2_IMPLEMENTATION_REPORT.md), [balance report](docs/V2_BALANCE_REPORT.md), and [320px final-result screenshot](docs/screenshots/v2-result-320.jpg) for evidence, exact assumptions and remaining manual checks.
