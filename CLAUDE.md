# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # tsc -b && vite build (what CI runs)
npm run lint      # oxlint
npm run preview   # preview production build locally
```

There are no tests. The build script runs `tsc -b` before Vite, so TypeScript errors fail the build — this caused the blank-page deploy bug previously. Always run `npm run build` locally before pushing.

## Architecture

**Single-page PWA**: React 19 + TypeScript + Tailwind v4 + Vite. No router — tab state lives in `App.tsx` (`useState<Tab>`). All trip/expense data is stored in Firestore; `localStorage` only persists `tet_active_trip` (the selected trip ID, a UI preference). `src/utils/storage.ts` contains `saveTrips`/`saveExpenses` which are now unused — only `loadActiveTripId`/`saveActiveTripId` are still called.

**State management** (`src/store/useStore.ts`): A single `useReducer` hook with a typed `Action` discriminated union. On `uid` change, loads all data from Firestore; each mutation does an optimistic local dispatch then a fire-and-forget Firestore write. `App.tsx` calls `useStore(uid)` once and passes slices/actions as props — no context provider. Member mutations (add/remove) use a `stateRef` to read current state synchronously inside the callback, avoiding stale closures.

**Data flow**: `activeTrip` and `activeExpenses` are derived in the store (`trips.find(...)`, `expenses.filter(...)`). Members are embedded inside `Trip` objects, not a separate Firestore collection. `Trip` has `ownerUid` and `memberUids` (all Google-authed members' UIDs) which drives Firestore security rules and the "my trips" query.

**Edit trip** (`src/components/TripModal.tsx`): The same modal handles both create and edit. When `editTrip?: Trip` prop is provided, fields pre-populate, the existing `id`/`members` are preserved, and title/button text change accordingly. `App.tsx` tracks `editingTrip` state; `Header.tsx` shows ✏️ beside 🗑 for owned trips in the dropdown.

**Paid settlements** (`Trip.paidSettlements?: PaidSettlement[]`): Each entry stores `{ from, to, paidAt }` (member IDs + ISO date). Matched against computed settlements by `from+to` pair. The "✓ Paid" / "Undo" button in `PeopleTab` is gated to the receiving member (`s.to` member's `uid === currentUid`) or the trip owner. `toggleSettlementPaid` in the store finds the existing entry, adds or removes it, then calls `saveTrip`. The 💬 settlement share reminder button on each unpaid row calls `shareOrCopy()` with a pre-built message and disappears once marked paid.

**PDF export** (`src/utils/printPDF.ts`): `printTripSummary(trip, expenses)` builds a self-contained HTML string with inline styles, opens it via `window.open()`, then calls `window.print()` after 250 ms. On iOS Safari the print dialog includes "Save to Files" → PDF. Zero new npm dependencies. Button sits on the Dashboard next to 📤 Share.

**Expense search + category filter** (`src/components/expenses/ExpenseList.tsx`): A search bar filters by notes or category label; category chips only appear for categories actually present in the trip. Person filter, category filter, and search stack with AND logic.

**Settlement logic** (`src/utils/settlement.ts`):
- `computeBalances` — builds `Map<memberId, netBalance>` from all expenses
- `minimizeSettlements` — greedy creditor/debtor matching (Splitwise "Simplify"); fewest transactions
- `computeRawDebts` — pairwise per-expense debts, bidirectionally netted but not minimized

`PeopleTab` toggles between these two modes. `Dashboard` and `ShareModal` use only `minimizeSettlements`.

**Expense splits**: An `Expense` has either `splitAmounts?: SplitAmount[]` (custom per-member amounts) or uses `splitBetween: string[]` with equal division. If `category === 'custom'`, the display name comes from `customCategory` rather than `CategoryConfig`. The `createdByUid` field is stamped by `useStore.addExpense()` (not the form) and is used for edit/delete permission checks.

**Receipt photos** (`src/utils/imageCompress.ts`): Photos are compressed client-side via Canvas API (`compressToDataUrl`, 800px wide, 60% JPEG quality → ~150–300 KB) and stored as base64 data URLs in the `receiptPhotoUrl` field of the Firestore expense document. Firebase Storage is intentionally not used (would require paid plan). The CSP in `index.html` includes `blob:` in `img-src` because the canvas loader uses `URL.createObjectURL` temporarily during compression.

**Share card** (`src/utils/share.ts`, `src/components/ShareModal.tsx`): `buildShareText()` assembles a formatted text summary; `shareOrCopy()` calls `navigator.share()` (iOS native share sheet) with clipboard fallback. Triggered from the Dashboard tab's "📤 Share" button.

**CSV export** (`src/utils/export.ts`): `downloadCSV()` generates a CSV with expenses + settlement summary and triggers a browser download via `URL.createObjectURL`. Triggered from the Expenses tab.

**Firebase / Cloud sync** (`src/utils/firebase.ts`, `src/utils/auth.ts`, `src/utils/firestore.ts`): Google Auth via `signInWithPopup`. Data lives under `users/{uid}/trips` and `users/{uid}/expenses` — flat collections, one document per record. The `clean<T>()` helper in `firestore.ts` strips `undefined` fields before every `setDoc` call (Firestore rejects undefined). Auth state in `App.tsx` is `User | null | undefined`: `undefined` = Firebase still initializing, `null` = signed out → `<LoginScreen />`, `User` = main app.

**Env vars**: Firebase config uses `import.meta.env.VITE_FIREBASE_*`. Copy `.env.local.example` to `.env.local` for local dev. CI reads the same vars from repository secrets (Settings → Secrets → Actions).

**Firebase Console setup required** (one-time):
1. Authentication → Sign-in method → enable Google
2. Authentication → Authorized domains → add `bhojrajkale.github.io`
3. Firestore → Create database (production mode), then rules:
   ```
   match /users/{uid}/{document=**} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```

**Deployment**: GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci → npm run build → upload-pages-artifact → deploy-pages` on push to `main`. `vite.config.ts` sets `base: '/trip-expense-tracker/'` for the GitHub Pages subpath.

**TypeScript strictness**: `noUnusedLocals` and `noUnusedParameters` are enabled. When hiding UI sections, remove the variables that computed data for them, not just the JSX.

**Design system**: Apple-inspired light theme throughout. Key tokens: `#0066cc` (action blue), `#1d1d1f` (ink), `#f5f5f7` (parchment background), `#e0e0e0` (hairline border), `#7a7a7a` (muted text). Border radii: `rounded-[18px]` for cards, `rounded-[11px]` for inputs, `rounded-full` for buttons/pills. Frosted glass header/tab bar: `bg-white/80 backdrop-blur-xl`. Active scale feedback: `active:scale-95 transition-transform` on all tappable elements.

**Contact Picker API** (`src/utils/contacts.ts`): `navigator.contacts.select()` is a local OS API (no network). Available iOS Safari 14.5+, gated behind `isContactsSupported()`. The `+ Contacts` button in `PeopleTab` is conditionally rendered.

**Join flow** (`src/components/join/JoinTripScreen.tsx`): Handles invite-link deep links for non-owner members to join a shared trip.
