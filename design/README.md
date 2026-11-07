Handoff is a white-label trading layer that licensed wallets embed. The screen carries the wallet's brand around it, so Handoff's own identity has to be quiet, trustworthy and recognisable from one mark. These rules exist so a second teammate can refine the system without re-deciding anything.

## Voice

- Write in Spanish for the wallet screen and the issuer console. Argentine register: "vos", "vendé", "tenés". English only in the README and pitch when the audience is international.
- Say what happens, in the user's words: "Vender 4 tokens", "Pagada · sin gas", "Bloqueado · verificá tu identidad". Never "ejecutar orden", never "userOp".
- One accent per screen. The one thing the user is here to do is in `ember`; everything else is `brand` or `ink`.
- State the demo caveat in `caption` on every screen that shows an attestation: "Atestaciones de demostración en Fuji, sin verificación de identidad."
- No exclamation marks, no emoji, no "¡Felicitaciones!". A fill confirms with "Vendido" and a hash.

## Color

- Ground every screen on `surface`. Put cards, rows and sheets on `surface-raised`, inputs on `surface-sunken`.
- Text is `ink`; secondary text is `ink-muted`. Both are tested on all three surfaces in both themes.
- `brand` is the Handoff teal: links, secondary buttons, selected tabs, the logo bars. Text on a brand fill is `on-brand`.
- `ember` is the handoff moment: the primary button and nothing else on that screen. Text on it is `on-ember`. `ember-bright` is reserved for the token disc in the logo.
- Status is always a word plus a color, never color alone: `good` for verified, filled, acknowledged; `warn` for pending or outside band; `bad` for blocked, reverted, unverified. Each sits on its `-soft` background in chips and panels.
- Borders are `line`; borders that must be seen are `line-strong`. Cards use a border, not a shadow. The only shadow is `shadow-sheet` on the bottom sheet.
- Dark theme is not an inversion: `brand` and `ember` lighten, so their `on-` tokens darken. Use the tokens, never a literal hex.

## Type

- Three families, hosted on Google Fonts: Schibsted Grotesk for `display-*` and `title`, IBM Plex Sans for text, IBM Plex Mono for every number.
- Load them with one link: `https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap`.
- Screen titles use `display-l` in the issuer console and `title` inside the wallet screen. `display-xl` is for slides.
- Running text is `body`; names and button labels are `body-strong`; helper lines are `caption` in `ink-muted`; section labels are `label`, uppercase.
- Every price, quantity, balance and address is set in the mono styles: `amount`, `amount-l`, `hash`. Never set a number in the sans. Format amounts as `USDC 112,00`, Argentine decimal comma, thin space thousands.
- Truncate addresses and hashes to four plus four with an ellipsis: `0x8a1f…c42e`.

## Spacing and radius

- Phone gutter is `space-4`. Sections are `space-5` apart. Card padding is `space-4`, chip padding `space-3` horizontally and `space-1` vertically.
- Buttons and rows take `radius-md`; cards and sheets `radius-lg`; chips and the account badge `radius-pill`; inputs `radius-sm` on desktop, `radius-md` on phone.
- Touch targets are at least 44px tall. The primary button is 48px.

## Logo

The mark is an H: two rounded bars (the two verified holders) and a token disc crossing the track between them. The wordmark is "handoff", lowercase, set in Schibsted Grotesk Bold and converted to outlines.

- Files live under `assets/Logos/`. Use them as they are; never redraw, never retype the wordmark in live text.
- `handoff-lockup-horizontal.svg` is the default. Use it in headers and the README. `handoff-lockup-stacked.svg` is for square spaces and slides. `handoff-mark.svg` alone when the name is already on screen or the space is under 120px wide. `handoff-app-icon.svg` for favicons and app tiles.
- On dark or `brand` backgrounds use the `-reverse` files. On photographs use `handoff-mark-mono.svg` or the reverse mark, never the color mark.
- Clear space around any lockup is the width of one bar (12 units at 64px). Minimum size is 24px for the mark and 96px wide for the horizontal lockup.
- Inside a host wallet the Handoff mark appears once, small, in the footer line "Operado con Handoff", in `ink-muted`. The wallet's brand owns the header.
- Do not recolor the bars, rotate the mark, add a gradient, outline the disc, or place the wordmark above the mark.

## Components

- `Button`: `primary` is `ember` and appears once per screen. `secondary` is a `brand` outline. `ghost` is text-only in `brand`. `danger` is `bad` and only for revoke and cancel. Labels are verbs: "Confirmar venta", "Cancelar orden", "Revocar".
- `StatusPill`: a word plus a color on a `-soft` ground. Statuses are `verified`, `blocked`, `pending`, `sponsored`, `agent`. Never show a pill without its word.
- `AssetRow`: name in `body-strong`, meta in `caption`, price in `amount`, delta in `good` or `warn` with its sign. Rows are 64px and separated by `line`.
- `Amount`: wraps a number in the mono style so no number escapes into the sans.
- Everything else (inputs, tabs, sheets) is plain HTML styled with the tokens until a teammate adds it here.

## States

- Verified, blocked, pending and sponsored are the four states a user meets. Each has a `StatusPill` and, for blocked, a `bad-soft` panel that says what to do: "Verificá tu identidad en la billetera para operar."
- A reverted transaction is shown, not hidden: `bad` pill, the hash, and a one-line reason.
- A pending registry report shows a `warn` pill reading "Reporte pendiente", never a spinner alone.
- Focus is a solid 2px `focus` ring with 2px offset on every interactive element.

## Iconography

- Use Lucide icons at 20px with a 1.75px stroke in `currentColor`. Stroke, not fill. No emoji anywhere.
- Status pills use check, x, clock and zap (for sponsored). Keep the set under twenty icons.
- The logo mark is not an icon. Do not use it inline at 16px.

## Motion

- One transition: 150ms ease on color and background for hover and focus. No slide-ins, no confetti on a fill. The confirmation is the hash appearing.
- Respect `prefers-reduced-motion` by disabling the one transition.
