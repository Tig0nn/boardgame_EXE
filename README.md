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

The authoritative rules are in [XVTL_GAME_SPEC_V2.md](docs/XVTL_GAME_SPEC_V2.md). The primary Web MVP uses Experimental B: 50M VND, four laps on C20, and 4/5/6% simple savings rates for 1/2/3-START terms. Original (three laps, A20) and Experimental A remain available internally for historical replay and regression tests. Winning requires enough lawful proceeds to buy an 80M item and retain 10M after purchase. The calculation includes net sale quotes and redeemable savings principal, subtracts outstanding debt and obligations, and excludes unsold business capital.

- The data-driven 20-tile board has dedicated bank, stock, bond, gold, business, course, living expense, personal shock, macro and obligation tiles, plus START. Living expenses apply only on exact landing.
- START processes normal market changes, 14M salary (plus a purchased course's 3M increase), business cashflow, deposit maturities and bond schedules, then debt and obligations. A sell-only checkpoint follows every lap, including the last. Overshoot resolves after settlement and the next forecast; final-lap overshoot is discarded.
- A course costs 6M once per game and increases salary from the next START. Voluntary purchases require cash and the corresponding landed tile; START allows only financial asset sales and debt repayment.
- Savings are separate deposit lots with 1/2/3-lap terms and configurable simple interest. Maturity pays once. Mandatory funding may redeem a whole lot early, forfeiting its unpaid term interest; a late maturity is disclosed.
- Six fictional stocks in three sectors share deterministic market and sector movement plus individual variation. Twelve historical points use a separate RNG stream. Charts, trades and portfolio valuation use the same current price.
- Macro events immediately update stock, bond, gold and business state once. START compounds normal returns from those updated prices. Bonds have coupons and principal schedules; gold has a disclosed sale spread.
- Business investment and repeatable trend upgrades produce recurring cashflow. Base upgrade benefits persist through trend changes; matching bonuses depend on the current trend. Sale uses remaining recoverable capital and is permitted only at a business tile.
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

Verification on 11 October 2026: 109/109 engine tests, 19/19 diagnostic tests, ESLint, TypeScript and the production build passed. Browser checks cover 320px, 390px, 430px and 1440px, all financial transaction families, and a complete four-lap Experimental B game (26 rolls, 102.8M lawful proceeds). Its exported state matches the prior V2.2 playthrough exactly. See [mobile MVP report](docs/MVP_MOBILE_UI_REPORT.md) and [machine-readable browser evidence](docs/playtests/mobile-mvp/verification.json).

Additional checks:

```sh
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npx tsc -b
node --experimental-strip-types scripts/verify-mobile-ui.mjs
```

The UI script needs a running Vite server and an existing Playwright installation with Chrome. Set `PLAYWRIGHT_MODULE` to its absolute module directory when using a bundled installation; `UI_URL` defaults to `http://localhost:5173`. No production dependency is added. The script saves screenshots, downloads a real browser log, replays every snapshot, and stores the verified log as gzip under `docs/playtests/mobile-mvp/`. Financial harness cases are explicitly synthetic and development-only.

See the Vietnamese [implementation report](docs/V2_IMPLEMENTATION_REPORT.md), [balance report](docs/V2_BALANCE_REPORT.md), and [320px final-result screenshot](docs/screenshots/v2-result-320.jpg) for evidence, exact assumptions and remaining manual checks.
