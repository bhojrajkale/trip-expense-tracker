# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # tsc -b && vite build (what CI runs)
npm run lint      # oxlint
npm run preview   # preview production build locally
```

There are no tests. The build script runs `tsc -b` before Vite, so TypeScript errors fail the build — this is what caused the blank-page deploy bug previously.

## Architecture

**Single-page PWA**: React 19 + TypeScript + Tailwind v4 + Vite. No router — tab state lives in `App.tsx` (`useState<Tab>`). All data is stored in `localStorage` via three keys (`tet_trips`, `tet_expenses`, `tet_active_trip`). Zero network calls — `connect-src 'none'` in the CSP meta tag enforces this at the browser level.

**State management** (`src/store/useStore.ts`): A single `useReducer` hook with typed `Action` discriminated union. `useEffect` watchers sync each slice to `localStorage` whenever state changes. `App.tsx` calls `useStore()` once and passes slices/actions as props down to tab components — there is no context provider.

**Data flow**: `activeTrip` and `activeExpenses` are derived from the store (`trips.find(...)` and `expenses.filter(...)`). Members are embedded inside `Trip` objects, not a separate collection.

**Settlement logic** (`src/utils/settlement.ts`):
- `computeBalances` — builds a `Map<memberId, netBalance>` from all expenses
- `minimizeSettlements` — greedy creditor/debtor matching (Splitwise "Simplify" behaviour); fewest transactions
- `computeRawDebts` — pairwise per-expense debts, bidirectionally netted but not minimized

`PeopleTab` toggles between these two modes. `Dashboard` uses only `minimizeSettlements`.

**Expense splits**: An `Expense` has either `splitAmounts?: SplitAmount[]` (custom, per-member amounts) or uses `splitBetween: string[]` with equal division. If `category === 'custom'`, the display name comes from `customCategory` string rather than `CategoryConfig`.

**Deployment**: GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci → npm run build → actions/upload-pages-artifact → actions/deploy-pages`. The `vite.config.ts` sets `base: '/trip-expense-tracker/'` for the GitHub Pages subpath. Failing TypeScript will fail the build and cause GitHub Pages to fall back to deploying raw source — always run `npm run build` locally before pushing.

**TypeScript strictness**: `noUnusedLocals` and `noUnusedParameters` are enabled. When hiding UI sections, remove the variables that computed data for them, not just the JSX.

**Contact Picker API** (`src/utils/contacts.ts`): `navigator.contacts.select()` is a local OS API (no network). It is available in iOS Safari 14.5+ and gated behind `isContactsSupported()`. The `+ Contacts` button in `PeopleTab` is conditionally rendered.
