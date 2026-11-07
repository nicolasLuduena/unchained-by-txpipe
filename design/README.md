Handoff is a white-label trading layer that licensed wallets embed. Its system has one idea: every order is a coupon that validates, tears or voids, and nothing disappears. These rules exist so a teammate can extend the system without re-deciding anything. Open `index.html` to see all of it.

Screens are dark. There are no white or near-white grounds.

## Voice

- Write in Spanish for the wallet screen and the issuer console. Argentine register: "vos", "vendé", "tenés". English only in the README and pitch when the audience is international.
- Say what happens, in the user's words: "Vender 4 tokens", "Sin gas", "Verificá tu identidad". Never "ejecutar orden", never "userOp".
- State the demo caveat in `caption` on every screen that shows an attestation: "Atestaciones de demostración en Fuji, sin verificación de identidad."
- No exclamation marks, no emoji. A fill confirms with "Vendido" and a hash.
- Never say "compliant". `PRODUCT.md` lists the other wording limits; they are legal in origin.

## Color

- Ground every screen on `ground`, old navy. Put coupons, rows and panels on `coupon`, the part below a perforation on `stub`, and inputs on `well`.
- Text is `text`, a buff; secondary text is `text-muted`. Both pass 4.5:1 on all four grounds.
- `amber` is the only ink for value and action: figures, stub heads, the band mark, the current tab, selection, the caret and the one primary action. Text on it is `on-amber`. Ghost buttons and links stay `text`.
- `good` and `bad` belong to words and the marks beside them: a stamp, an error line, the danger outline, the invalid input, the out-of-band mark. Never a fill behind text.
- `rule` draws the structure of a coupon. `rule-soft` separates rows and is decorative.
- Use the tokens, never a literal hex. Edit `tokens.json` and run `node design/build-tokens.mjs` to regenerate `tokens.css`.

## Type

- Barlow Condensed for titles, coupon heads, buttons, tabs and stamps, always uppercase. Barlow for running text, field labels and every figure, with tabular numerals. Spline Sans Mono only for hashes and addresses, where `0` and `O` must differ.
- All three are self-hosted in `fonts/` under the SIL OFL (`fonts/OFL.txt`). Link `fonts/fonts.css`; nothing is fetched from a CDN, so the system renders offline.
- `display-xl` is for slides. `display-l` titles a coupon or console screen. `label` heads coupons.
- Every price, quantity, balance and address is a figure: `Amount` or `Hash`. Format amounts as `USDC 112,00`, with a decimal comma and a dot for thousands: `3.418,00`.
- Truncate addresses and hashes: `0x8a1f…c42e`.

## Shape

- Every corner is square. Coupons are cut stock; the only curves are the notches at each end of the perforation. A `rule-soft` hairline holds the coupon's long edges on a projector.
- Fields share hairlines in a ruled grid. Cards are not used; the coupon is the container, and coupons never nest.
- Phone gutter is `space-4`. Sections are `space-5` apart. Touch targets are at least 44px; the confirm button is 56px.
- The only elevation is `shadow-sheet`, on the bottom sheet. Inset strokes on coupon edges and the current tab are lines, not shadows.

## States

- A status is a word in a ruled box, and the border carries it without colour: solid for done, dashed for pending, double for blocked or voided, hairline for an agent, dotted for unused. It must read in grayscale, because a projector washes colour out.
- There is no icon set, by choice: states are words, and words are what a regulated state needs.
- Nothing disappears. A cancelled or reverted order stays on screen, its total struck through, a large stamp across the perforation, and a one-line reason.
- A reverted transaction shows its hash and reason.
- A blocked state is a `Notice` that says what to do: "Verificá tu identidad en la billetera para operar."
- A pending registry report is a stamp reading "Reporte pendiente", never a spinner alone.
- Focus is a solid 2px `focus` ring with 2px offset on every interactive element.

## Motion

- One signature moment: when a fill lands, the stub tears away along the perforation, stays parted, and the stamp lands, once, in `duration-tear`. Nothing else moves except 150ms color changes on hover and focus.
- `prefers-reduced-motion` removes the motion; the stub still rests parted.
- `Sheet` ships as a static surface. Placement, scrim and dismissal belong to the app.

## Inside a host wallet

The wallet's brand owns the header and navigation. Handoff appears once, small, through `OperatedBy`: "Operado con Handoff". How far a host may restyle the coupon is still undecided.

## Components

`Button`, `Stamp`, `Amount`, `Hash`, `Fields`, `Coupon`, `AssetRow`, `TextField`, `PriceBand`, `Tabs`, `Notice`, `Sheet`, `FeedRow` and `OperatedBy` are in `components/`. Each folder has a README and a `preview.html`, and `index.d.ts` types the API.

## Logo

See `logos/README.md`. The mark is an H whose crossbar is a perforation. `OperatedBy` is the one exception to "never recolor": it takes the text color so the host's brand stays first.
