# Design — Silver Thief Bug

Locked design system. Future Hallmark runs read this file first; pages defer
to it. Amend intentionally — the file is the rule. Every page (shop, account, admin) is on
this system; the legacy `silver-*` / `orange-*` palette and gradients are removed from Tailwind,
so an off-system colour no longer compiles into anything.

## System
- Genre · editorial (a naturalist's field guide for beetle collectors)
- Theme · custom (vibe: "warm paper, ink, one orange accent")
- Axes · light paper / classical-serif display / warm accent
- Audience · Thai collectors, mostly on phones from Facebook/LINE → mobile-first (320 / 375 / 414 / 768 px)
- Shop flows (checkout) are focused: own header (mark + back action) and a one-line footer, no shop nav

## Tokens (canonical · `frontend/src/index.css` is the source of truth)
Role tokens are OKLCH `L C H` triplets on `:root`, redefined under `.dark`, and exposed
as Tailwind colours (`bg-paper`, `text-ink`, `border-line`, `bg-accent-strong`, …).
Never inline hex/OKLCH in components; add a token first.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | 97.5% 0.008 85 | 19% 0.012 60 | page background |
| sunken | 94.5% 0.012 85 | 23% 0.014 60 | the one raised/sunken panel (summary, notices) |
| ink | 24% 0.02 60 | 93% 0.012 80 | text |
| muted | 48% 0.02 65 | 70% 0.015 75 | secondary text (≥ 5.5:1) |
| line | 87% 0.015 80 | 33% 0.015 60 | hairlines, borders |
| accent | 72% 0.17 55 | 76% 0.15 58 | decoration only (< 3:1 on light paper) |
| accent-strong | 54% 0.16 48 | 74% 0.16 55 | buttons, links, focus, active step |
| accent-ink | 99% 0.004 85 | 20% 0.02 55 | text on accent-strong (5.2:1 / 7.5:1) |
| success / danger | 50% .12 150 · 52% .18 28 | 74% .13 150 · 70% .16 28 | "free", errors |

Type (Google Fonts, only these weights): display **Noto Serif Thai 700** (`font-display`),
body **IBM Plex Sans Thai 400–700** (`font-sans`, default), data **IBM Plex Mono 400/500**
(`font-mono` + `tabular-nums` for prices, sizes, order numbers, timers).
Headings are always roman; scientific names may be italic in running text only.

Radius · 12 px (`rounded-xl`) controls and notices · 16 px (`rounded-2xl`) the summary panel.

## CTA voice
- Primary · solid `accent-strong` on `accent-ink` · `rounded-xl` · full width in forms ·
  label one line, short ("ชำระ ฿3,200", details on a line below) · hover darkens · no gradient, no glow.
  Shared as `primaryButton` (`frontend/src/component/ui/buttonStyles.ts`).
- Secondary · text link in `accent-strong`, underline on hover (e.g. "เปลี่ยนที่อยู่").
- Destructive · never a solid button. A quiet `muted` text link (hover `danger`) opens an inline
  confirmation: one sentence saying what is lost, then [keep] bordered `line` and [confirm] bordered
  `danger`, with focus on keep. Used for cancelling an order (it releases one-of-a-kind stock).

## Shared pieces (use these, don't restyle per page)
- `component/ui/buttonStyles.ts` · `primaryButton` (full width) / `primaryButtonInline` / `compactButton` (card actions) /
  `secondaryButton` (bordered) / `iconButton` (40×40, always with aria-label) / `textLink` / `quietLink` / `chip(active)`.
- `component/ui/fieldStyles.ts` · `fieldClass(err)`, `fieldLabel`, `fieldError`, `fieldHint`. Every input has a visible `<label>`.
- `component/ui/Feedback.tsx` · `PageHeader` (one `font-display` h1 + line, hairline under), `Notice`, `ErrorBox`, `EmptyState`.
- `component/products/ProductCard.tsx` · the one product tile (Products and Favorites), photos, heart, stock line.
- `component/brand/social.tsx` · the shop's channels, phone, email, map link (Home, About, footer).
- `component/common/Modal.tsx` · dialog with Escape, focus in/out, bottom sheet on phones, never taller than the viewport.

## Layout
- One containment layer. No card-in-card; sections split by `line` hairlines.
- Forms: content left, sticky summary right at `lg` (`minmax(0,1fr) 22rem`); on small screens the
  summary folds into a bar showing the total.
- Feedback is inline: errors in a `danger` box above the action with the next step; notices
  (`role=status`) in `sunken`. No SweetAlert popups and no success toasts on customer pages; adding to the
  cart answers on the button ("เพิ่มแล้ว") and by opening the Cart drawer. SweetAlert remains only for admin tools,
  the session-expiry notice and the guest "sign in to save favorites" prompt; `index.css` themes it with the tokens.
- Product grids: 2 columns on phones, 3 at `lg`, 4 at `xl`; photos 4:3 in a `line`-bordered frame, text below on paper (no card).
- Shop nav shows in full from `lg` (1024 px); below that, cart + menu button. Active link: `ink` with an accent-strong underline.
- Status chips (`ORDER_STATUS_STYLE`): `rounded-md`, neutral by default; accent-strong only for "waiting on the customer",
  success for delivered/paid, danger for failed.
- Record pages (an order) use the same two-column grid as the forms: details left, the summary right.
  Their `h1` is the record's state in words (the Order Status in Thai); the reference number sits
  under it in mono. Progress is a vertical list on a `line` rule, not a row of icons.

## Motion stance
- Near-silent: one short slide between checkout steps; colour/press feedback on controls.
- `MotionConfig reducedMotion="user"` wraps the app; CSS transitions carry `motion-reduce:` variants.

## Brand
- Mark · `BeetleMark` (rhinoceros beetle, top view) in `accent-strong`; temporary until the shop
  supplies its real logo. `favicon.svg`, theme-color and `manifest.json` repeat token values as hex.

## Exports
`frontend/src/index.css` (tokens) + `frontend/tailwind.config.js` (Tailwind mapping) are the source
of truth. Ask for other formats (DTCG `tokens.json`, shadcn variables) if a new project needs them.
