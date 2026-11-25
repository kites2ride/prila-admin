# Prila Admin â€” DESIGN.md

Operate-mode product UI: scannable, consistent, quiet. Brand shows in precise details, not decoration.
Sources: Taste Skill (Leonxlnx), elayadesign/ai-design-skills (spacing/radius/type system), Vercel Web Interface Guidelines, awesome-design-md (Linear/Vercel), Emil Kowalski's design-eng skill, Impeccable.
Workspace rules still win: flat, **zero gradients** in product UI (see `../docs/UI_REFERENCE.md`).

## Tokens (`src/index.css`)
- Ink `#0F172A` (primary buttons, headings) Â· Accent `#6D28D9` (active nav, focus, links only) Â· Accent soft `#F5F3FF`
- Surfaces: page `#F6F7F9`, card `#FFFFFF`, quiet `#F8FAFC`; borders `#E2E8F0` / `#F1F5F9`
- Type: Plus Jakarta Sans, tabular numerals everywhere, headings `text-wrap: balance`, tracking -0.02em
- Scale: page title 24/700 Â· card title 15/700 Â· body 14 Â· label 13 Â· table header 11 caps
- Radius: buttons 12 (small 10) Â· inputs 12 Â· cards 16 Â· pills 999

## Components
- **Buttons**: `.btn` + `btn-primary | secondary | soft | success | warn | danger | danger-soft | link`, `btn-sm`. Press = scale(.97).
- **Badges**: `.badge` + `badge-success | danger | warn | info | accent`. Always carry a text label (never colour alone).
- **Shared**: `Card/Field/Toggle` (formKit), `StatCard`, `ListPage`, `Badge/EmptyState/PageHeader` (ui.tsx), `CommandPalette` (Ctrl/Cmd+K).

## Motion
- Ease-out `cubic-bezier(0.23,1,0.32,1)`, 150â€“250 ms, transform/opacity/colour only, never `transition: all`.
- No animation on things used constantly (nav, table rows, command palette). `prefers-reduced-motion` honoured.

## Rules adopted from awesome-design-md (Vercel + Linear DESIGN.md)
- Weight ceiling 600 for headings; display tracking strongly negative (h1 -0.04em). Sentence case everywhere, no all-caps headers.
- Elevation = stacked small shadows over a 1px hairline: L2 cards, L4 hovered link-cards, L5 modals/menus. Never one heavy drop.
- Radius scale 6 (small/nav) · 8 (buttons, inputs) · 12 (cards, dialogs). CTAs are never pill-rounded.
- Controls are 40px tall (32px small). Focus ring 2px accent at 50%. Selection = ink on near-white.
- One accent (violet) used for focus, links, current selection only. Mono face (Geist Mono) for IDs, kbd and technical values.

## Motion tokens (from Taste Skill's hover layer)
- `--m-in` 150ms hover in Â· `--m-out` 120ms hover out Â· `--m-press` 90ms press. Fine pointers only.
- Button: hover steps the fill + lifts 1px + soft shadow; press sinks 1px and scales .985. No glow, no shine sweep.
- Cards: only cards that lead somewhere (`.surface-link`) lift 2px. Plain `.surface` cards never move.
- Links in text: `.link` draws its underline leftâ†’right. Switch knob slides by transform.

## Surfaces & forms
- `.surface` = white, 1px border, 16px radius, layered soft shadow. `.field` = every input/select/textarea. `.alert-*` = inline messages.
- Statuses always go through `StatusBadge` (one colour logic); people get an `Avatar`.
- Icons: lucide-react, 16px, stroke 1.85, one family (`lib/nav.ts`).

## Feedback & overlays
- Saves/success go through `toast()` / `<MsgToast msg={msg} />` (bottom-right, polite live region, auto-dismiss). Errors that need a decision stay inline as `.alert-danger`.
- `ConfirmDialog`: backdrop fades 160ms, panel eases up from .96 over 200ms, click-outside and Esc cancel.
- `ListPage` shows an `EmptyState` automatically when total is 0. Clickable table rows are keyboard-focusable (Enter/Space).

## Data presentation (stakeholder-grade details)
- Every number, money and date goes through `src/lib/format.ts` (never `toLocaleString()` or `toFixed`). Money is Indian-grouped (₹1,84,520), paise shown only when non-zero; dates are always IST: `25 Nov 2026, 2:38 pm`.
- Numeric columns are right-aligned with tabular figures. Dates and badges never wrap; tables scroll sideways inside their card on small screens.
- Each route sets its own tab title (`Rides · Prila Admin`). A render crash shows `ErrorBoundary` (page-level, sidebar still works), never a blank screen. Boot screen shows until React mounts.
- Print / Save as PDF hides navigation and shadows (`@media print`). Version shown in the sidebar footer.

## Dark mode
- Light / Dark / System in Settings. The choice is saved in localStorage and applied before first paint (no white flash). `src/lib/theme.ts` sets `data-theme` on <html>.
- Dark palette is Linear's (awesome-design-md): neutral near-black canvas `#010102`, surface ladder `#0f1011 / #141516 / #18191a`, hairlines `#23252a`, text `#f7f8f8 / #d0d6e0 / #8a8f98`. No blue or purple tint, no card shadows; the lavender `#5e6ad2` is only the keyboard focus ring. Active states are white, never a purple fill.
- Dark works by redefining Tailwind's colour variables (slate scale + tinted hues) and the `--prila-*` tokens in `index.css`, so pages need no per-page dark classes. Never hard-code hex colours in pages; use tokens or Tailwind colour classes.
- `bg-white` maps to the surface token. Overlays use `bg-black/50` (never slate-900, which flips). Knob/brand panels that must stay fixed use a literal colour (`bg-[#ffffff]`, `.login-brand`).

## KYC approval alerts
- `src/lib/kycAlerts.ts` polls `/admin/kyc/count` every 30 s, including in background tabs when alerts are on. A submission is new only if its time is later than any seen before (approving the newest must not alert; a resubmission must).
- Outputs: toast, system notification via `public/sw.js` (needed on phones and Chrome), count in the tab title. `sw.js` is served `no-cache` (nginx.conf).
- Needs HTTPS in production. Works while the panel is open; alerts with the browser closed need Web Push plus a backend endpoint.

## Rules of thumb
- Accent colour = action or current selection, nothing else. No bars down one side of a card. No nested cards.
- Every state exists: hover, focus-visible, active, disabled, loading (skeleton), error, empty (says what to do next).
- Destructive or money actions confirm with a reason (see ConfirmDialog).





