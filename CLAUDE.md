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

**Trip modal — create / edit / duplicate** (`src/components/TripModal.tsx`): One modal, three modes. `editTrip?: Trip` pre-fills and preserves `id`/`members`; `duplicateFrom?: Trip` pre-fills name ("… (copy)"), destination, and budget but creates a new trip — start date resets to today, and `App.tsx`'s duplicate handler clones members with fresh ids while keeping account links (`uid`/`email`/`photoURL`), copying neither expenses nor `paidSettlements`. `App.tsx` tracks `editingTrip`/`duplicatingTrip` state. Header dropdown row buttons: ✏️ edit and 🗑 delete are owner-only; ⧉ duplicate and 📦 archive appear on shared trips too.

**Archive trips** (`Trip.archived?: boolean`): Trip-level flag (applies for all members, reversible). `toggleArchiveTrip` in the store flips it; archiving the active trip falls back to the next non-archived one, and default trip selection on load skips archived trips. The header dropdown shows non-archived trips plus a collapsible "Archived (n)" section with Restore; `App.tsx` shows an "All trips archived" empty state when `activeTrip` is null but trips exist, and the header "No trip" label stays tappable so the picker (and Restore) remains reachable.

**Paid settlements** (`Trip.paidSettlements?: PaidSettlement[]`): Each entry stores `{ from, to, paidAt }` (member IDs + ISO date). Matched against computed settlements by `from+to` pair. The "✓ Paid" / "Undo" button in `PeopleTab` is gated to the receiving member (`s.to` member's `uid === currentUid`) or the trip owner. `toggleSettlementPaid` in the store finds the existing entry, adds or removes it, then calls `saveTrip`. The 💬 settlement share reminder button on each unpaid row calls `shareOrCopy()` with a pre-built message and disappears once marked paid.

**Activity feed** (`src/components/activity/ActivityFeed.tsx`, Feed tab): Append-only event log in `trips/{id}/activity` — expense added/updated/deleted, member added/removed/joined, settlement paid/unpaid, trip edited. Entries are written fire-and-forget by the `log()` helper in `useStore` (never blocks a mutation); `joinTrip` in `firestore.ts` logs `member_joined` directly. Actor names are denormalized at write time so entries survive member removal; the component does its own realtime subscription (`subscribeActivity`, newest 50, ordered by `at` desc) rather than going through the store. Rules: members read and create entries stamped with their own `actorUid`; no updates; owner deletes (done in `removeTrip` cleanup). When adding a new mutation to the store, add a matching `log()` call and, if it's a new event shape, extend `ActivityType` + the `ActivityRow` switch.

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

**Firebase / Cloud sync** (`src/utils/firebase.ts`, `src/utils/auth.ts`, `src/utils/firestore.ts`): Google Auth via `signInWithPopup`. Data layout: `trips/{tripId}` (shared, queried by `memberUids array-contains uid`) with subcollections `expenses/{expenseId}` and `activity/{activityId}`. The legacy `users/{uid}/…` layout is auto-migrated on login by `migrateLegacyData` (copy-then-delete, idempotent). `memberUids` is always derived via `memberUidsFor()` — never edit it directly; `cleanTrip()` recomputes it on every save. The `clean<T>()` helper strips `undefined` fields before every `setDoc` (Firestore rejects undefined) — this is why optional Trip/Expense fields can be added freely without migrations. Auth state in `App.tsx` is `User | null | undefined`: `undefined` = Firebase still initializing, `null` = signed out → `<LoginScreen />`, `User` = main app.

**Env vars**: Firebase config uses `import.meta.env.VITE_FIREBASE_*`. Copy `.env.local.example` to `.env.local` for local dev. CI reads the same vars from repository secrets (Settings → Secrets → Actions).

**Firebase Console setup required** (one-time):
1. Authentication → Sign-in method → enable Google
2. Authentication → Authorized domains → add `bhojrajkale.github.io`
3. Firestore → Create database (production mode), then publish rules

**Firestore rules**: `firestore.rules` in the repo root is the source of truth, but there is no Firebase CLI — any rules change must be manually pasted into Firebase Console → Firestore → Rules → Publish (https://console.firebase.google.com/project/trip-expense-tracker-f4a5b/firestore/rules). Key invariants encoded there: trip create requires being owner + in `memberUids`; members may edit trip fields but only ever grow `members`/`memberUids`, and a non-owner update may never mutate an *existing* member entry's fields in place — `isMembersGrowthOnly()` enforces append-only via `hasAll`, and the one legitimate exception (a joiner claiming an unclaimed "offline" member by attaching their own uid) is checked field-by-field by `isValidClaim()`; only the trip owner can edit another member's details or shrink the array (remove a member); expense edit/delete restricted to creator or owner, and every expense write must pass `isValidExpense()` (doc id/tripId match the path, amount is a number in (0, 9999999], category in the fixed enum, non-empty paidBy/splitBetween, `date.size() == 10`, notes ≤ 200 chars — mirror of the client form's validation, so if the form's bounds change, change the rule too); activity is append-only with `actorUid == auth.uid`. When adding a new way to write `trip.members`, re-derive which of `isMembersGrowthOnly`/`isValidClaim`/owner-only it falls under — don't add a fourth unrestricted path.

**Deployment**: GitHub Actions (`.github/workflows/deploy.yml`) runs `npm ci → npm run build → upload-pages-artifact → deploy-pages` on push to `main`. `vite.config.ts` sets `base: '/trip-expense-tracker/'` for the GitHub Pages subpath.

**TypeScript strictness**: `noUnusedLocals` and `noUnusedParameters` are enabled. When hiding UI sections, remove the variables that computed data for them, not just the JSX.

**Trip/Expense writes are full overwrites — never rebuild documents from partial data**: `saveTrip`/`saveExpense` use `setDoc` without merge, and `clean()` strips `undefined`, so any field omitted from an update object is permanently deleted from Firestore. Always spread the existing document first and override only the fields being changed (`{ ...existingTrip, ...changes }`), the way `toggleSettlementPaid`/`toggleArchiveTrip` and the App.tsx edit handler do. Constructing a Trip/Expense object literal from form fields and saving it will silently wipe optional fields (this happened: editing a trip used to delete `paidSettlements`/`archived`/`endDate`). TypeScript cannot catch this — optional fields make incomplete literals type-check.

**Design system / theming**: Apple-inspired, with light and dark palettes defined as CSS custom properties in `src/index.css` — components never hardcode colors, they use Tailwind arbitrary values like `bg-[var(--surface)]`, `text-[var(--ink)]`, `border-[var(--hairline)]`. Key tokens: `--action` (blue), `--ink` (primary text), `--bg` (page background), `--surface` (cards), `--muted`, `--hairline`, `--divider`, `--disabled`, `--green`/`--red`/`--orange` (+ `-tint`/`-border` variants), `--surface-glass`/`--surface-glass-nav` (frosted header/tab bar with `backdrop-blur-xl`). Dark values follow iOS system colors (`#1c1c1e` bg, `#0a84ff` blue). Theme switching (`src/utils/theme.ts`): manual toggle sets `data-theme` on `<html>` and persists to `localStorage` key `tet_theme`; with no stored choice, `@media (prefers-color-scheme: dark)` applies dark automatically. `App.tsx` applies the theme in a `useLayoutEffect` before paint; the ☀️/🌙 toggle lives in `Header`. When adding UI, always use the `var(--token)` classes — a hardcoded hex will break dark mode. Border radii: `rounded-[18px]` for cards, `rounded-[11px]` for inputs, `rounded-full` for buttons/pills. Active scale feedback: `active:scale-95 transition-transform` on all tappable elements. Z-index layers: TabBar `z-50`, sticky header `z-40`, all modals/overlays `z-[200]` (must sit above the TabBar).

**Contact Picker API** (`src/utils/contacts.ts`): `navigator.contacts.select()` is a local OS API (no network). Available iOS Safari 14.5+, gated behind `isContactsSupported()`. The `+ Contacts` button in `PeopleTab` is conditionally rendered.

**Join flow / pre-join preview** (`src/components/join/JoinTripScreen.tsx`, `tripsPreview/{tripId}` collection): Invite links resolve to `getTripPreview()`, which reads a reduced `TripPreview` doc (`name`/`destination`/`startDate`/`memberUids`/`members: {id,name,uid?}`) — deliberately no `email`/`photoURL`/`phone`/`budget`, so opening or forwarding a link never leaks member PII. `buildPreview()` in `firestore.ts` projects it from the real `Trip`; `saveTrip()` writes the real trip doc first, then the preview **sequentially, never batched** (the preview's write rule checks the trip's just-committed `memberUids`, so batching would evaluate against stale pre-write state) — this also self-heals trips created before this collection existed, the next time any of their data changes. `removeTrip()` deletes the preview alongside expenses/activity.

Joining is two separate functions, not one: `joinAsNewMember()` is a blind `arrayUnion` append needing no read of the trip at all (the common case). `claimMember()` (attaching your account to an existing "offline" member) requires replacing one array element in place, which Firestore can't do via `arrayUnion`/`arrayRemove` alone — it needs the full trip (fetched via `getTripForClaim()`, called only at the moment of that specific action, never on page load) to safely preserve every other member's data while rewriting the array. This is an accepted, narrow residual: claiming an identity still briefly exposes full member PII to the claimer, which Firestore's rules model can't avoid without either a paid Cloud Functions plan or migrating `members` from an array to an id-keyed subcollection (deferred; see security audit notes). The main `trips/{tripId}` `allow get` rule stays `isAllowedUser()`-only (not member-scoped) specifically to support this one path.
