# Performance Audit — URE Brasil

**Date:** 2026-03-26

---

## P0 — Critical (causing the ~58 score)

### 1. N+1 Query Waterfall in Header — `src/components/Header.tsx`

**4 separate sequential Supabase queries** fire on every page load:
- `fetchNotifications()` — lines 67–92
- `checkPhysicalCard()` — queries `student_profiles` then chains to `student_cards` — lines 94–139
- `fetchOpenTicketsCount()` — depends on `studentProfileId` state set by the above — lines 141–161
- `loadPhysicalAvulsaPrice()` — lines 163–178

The 3rd useEffect depends on `studentProfileId` state from the 2nd useEffect — a cascade that creates a waterfall of 4 round-trips before the header fully renders.

**Estimated impact: +1.5–2.5s per page load**

---

### 2. N+1 Queries in Dashboard — `src/pages/Dashboard.tsx`

`fetchData()` makes 4 sequential queries after the first resolves (profile → docs → payments → card), all with `select('*')`. Additionally `checkRecentPayment()` makes 3 more.

**Estimated impact: +3–5s on dashboard load**

---

### 3. `select('*')` Everywhere — 43+ instances across the codebase

Key offenders:
- `src/pages/Dashboard.tsx` lines 165, 195, 209
- `src/pages/Perfil.tsx` lines 231, 259, 282, 291, 303
- `src/hooks/useAuth.tsx` line 62
- `src/components/Header.tsx` line 77
- `src/pages/UploadDocumentos.tsx` lines 620, 639

Queries transfer 5–10x more data than needed.

**Estimated impact: 5–10x excess bandwidth on every query**

---

### 4. Admin Pages — No Pagination — `src/admin/pages/`

`Documents.tsx` (line 23), `Tickets.tsx` (line 26), and admin `Dashboard.tsx` (line 46) all fetch entire tables with no `.limit()`. Charts query all cards/payments for a 30-day window with no cap.

**Estimated impact: Will fetch 10K+ rows as data grows — already slow at scale**

---

### 5. `ProfileContext` Causes App-Wide Re-Renders — `src/App.tsx:85`, `src/contexts/ProfileContext.tsx`

`ProfileProvider` wraps the entire app and provides `{ avatarUrl, fullName, updateAvatar, refreshProfile }` as a single context value. Any profile update (every page mount) re-renders everything under it.

**Estimated impact: Full subtree re-render on every auth state change**

---

## P1 — High Impact Quick Wins

### 6. `html2canvas` + `jspdf` + `recharts` Not Lazy-Loaded — `package.json`

- `html2canvas` (~500KB) + `jspdf` (~200KB) — only used in `src/pages/Carteirinha.tsx`, imported statically at line 12
- `recharts` (~150KB) — only used in admin dashboard, imported at top level

All three are in the main bundle for every user.

**Estimated impact: ~850KB savings from main bundle**

---

### 7. All Core Pages Statically Imported — `src/App.tsx` lines 16–30

15 pages (Index, Login, SignUp, CompleteProfile, EscolherPlano, Pagamento, Checkout, etc.) are statically imported. Only secondary pages use `lazy()`. All acquisition-flow code lands in the main chunk.

**Estimated impact: ~500KB+ unnecessary initial load**

---

### 8. Signed URL Requests Inside a Loop — `src/pages/Perfil.tsx` lines 266–276

For each document in `docsData`, a separate `createSignedUrl()` call is made inside a `for` loop. With 5 documents = 5 round-trips sequentially.

**Estimated impact: +200ms per document on profile page**

---

### 9. `useAuth` Hook Fetches Profile on Every Use — `src/hooks/useAuth.tsx` lines 58–77

Every component calling `useAuth()` triggers a `student_profiles` query with `select('*')` on user change. No deduplication or shared state.

**Estimated impact: Duplicate DB queries from every consuming component**

---

### 10. Large PNG Templates — `public/templates/`

| File | Size |
|---|---|
| `geral-frente-template-v.png` | 247KB |
| `direito-verso-template-v.png` | 237KB |
| `geral-verso-template-v.png` | 225KB |
| `direito-frente-template-v.png` | 117KB |
| Others | ~215KB |

No WebP/AVIF alternatives. WebP would cut these by ~50–60%.

**Estimated impact: ~500KB savings on card generation page**

---

### 11. Radix UI Code-Split Incomplete — `vite.config.ts` lines 18–22

Only 3 of 20+ `@radix-ui/react-*` packages are in the `ui` chunk. The rest are in the main bundle even when unused on the current route.

**Estimated impact: +200–400KB in main bundle**

---

## P2 — Nice to Have

### 12. Render-Blocking Google Fonts — `index.html` lines 25–27

Font CSS loaded with `rel="stylesheet"` (blocking). Loading 6 weights (400–900) when 3–4 suffice. Should use `rel="preload" as="style"` + `onload` swap pattern.

**Estimated impact: +0.5–1s initial render delay**

---

### 13. Oversized Favicon — `public/favicon.png`

71KB favicon. Every user downloads it. Should be <5KB SVG or optimized PNG.

**Estimated impact: 66KB wasted on every user**

---

### 14. Missing `useCallback` on Header Handlers — `src/components/Header.tsx` lines 180–230

`handleSignOut`, `handleInstallClick`, `handleMyCardClick`, `handleMyProfileClick` são recriados a cada render e passados como props para itens filhos do dropdown, causando re-renders desnecessários.

**Estimated impact: Minor child re-renders on Header re-renders**

---

### 15. Large Monolithic Components

| File | Lines |
|---|---|
| `src/pages/UploadDocumentos.tsx` | 1,513 |
| `src/pages/Perfil.tsx` | 1,391 |
| `src/pages/Index.tsx` | 1,264 |
| `src/pages/Checkout.tsx` | 1,152 |

These are hard to optimize with `React.memo`/`useMemo` and tend to re-render entire sections for small state changes.

**Estimated impact: Harder to optimize, diffuse re-render cost**

---

### 16. Duplicate PWA Icons — `public/icons/`

Both `icon-512x512.png` (180KB) and `compr-icon-512x512.png` (23KB) exist. The large uncompressed versions are referenced in `vite.config.ts`.

**Estimated impact: ~150KB extra PWA cache**

---

## Top 3 to Fix First (biggest bang for buck)

1. **Consolidate Header queries into 1–2 calls** — eliminates 1.5–2.5s of waterfall on every authenticated page
2. **Switch `select('*')` to specific columns everywhere** — reduces query payload 5–10x, quick wins with grep-and-fix
3. **Lazy-load `html2canvas` + `jspdf` + `recharts`** — removes ~850KB from the main bundle immediately
