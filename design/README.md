Handoff is a white-label trading layer that licensed wallets embed. Its system has one idea: every order is a coupon that validates, tears or voids, and nothing disappears. These rules exist so a teammate can extend the system without re-deciding anything. Open `index.html` to see all of it.

The world is paper on plaster: a warm off-white ground, indigo hairlines that divide the page into a calm grid, and a three-colour chord of indigo, madder and saffron. Screens are light.

## Voice

- Write in English, second person, in plain words: "Sell 4 tokens", "No gas", "Verify your identity". Never "execute order", never "userOp".
- State the demo caveat in `caption` on every screen that shows an attestation, verbatim: "Demo attestations on Fuji, no identity verification."
- Say what a state means, not only its name. A stamp is one word, so put the meaning in the caption beside it.
- Name Fuji or the contract. Say "PSAV, a licensed virtual asset provider" once, where it first matters.
- No exclamation marks, no emoji. A fill confirms with "Sold" and a hash.
- Never say "compliant" or "sub-second" (say "about one second"). `PRODUCT.md` lists the other wording limits; they are legal in origin.

## Color

- Ground every screen on `ground`, plaster. Put coupons, panels and sheets on `coupon`, the part below a perforation on `stub`, and inputs on `well`.
- Text is `text`, indigo; secondary text is `text-muted`. Both pass 4.5:1 on all four grounds, and so do `good` and `bad`.
- `amber` keeps its name so nothing downstream breaks, but its value is indigo: it is the ink for value and action, and `on-amber` is the text on it. Never point it at saffron, which fails as text on plaster.
- `indigo`, `madder` and `saffron` are the chord: ribbons and colour bands. `saffron` is a fill only, always with indigo text on top.
- States: verified is `good`, deep green. Sold is filled indigo. Refused, blocked and cancelled are `bad`, deep madder. Pending is saffron with indigo text.
- `rule` draws the page grid and the structure of a coupon. `rule-soft` separates rows and is decorative.
- Use the tokens, never a literal hex. Edit `tokens.json` and run `node design/build-tokens.mjs` to regenerate `tokens.css`.

## Type

- Montserrat for display words, thin and uppercase with wide tracking, and for the small labels: buttons, tabs, stamps, field labels, tracked about .25em. Jost for running text and every figure, with tabular numerals. Spline Sans Mono only for hashes and addresses, where `0` and `O` must differ.
- All three are self-hosted in `fonts/` under the SIL OFL (`fonts/OFL.txt`). Link `fonts/fonts.css`; nothing is fetched from a CDN, so the system renders offline.
- `display-xl` is for slides. `display-l` titles a console screen. `label` heads coupons.
- Every price, quantity, balance and address is a figure: `Amount` or `Hash`. Format amounts as `USDC 112.00`, en-US: `3,418.00`.
- Truncate addresses and hashes: `0x8a1f…c42e`.

## Shape

- Coupons are square cut stock; the only curves are the notches at each end of the perforation. Buttons and inputs take `radius`, 2px.
- Remove a box wherever a hairline will do. Rows and fields are hairlines. Cards are not used except the swatch card, a `Notice`: paper, a hairline, a colour band on the right edge. The coupon carries the same band, and coupons never nest.
- `Ribbons` sweeps the chord across the top of a page. Keep text off its crossings: stop it on a hairline above any navigation.
- Navigation is a dot per place, filled for the current one. `hf-tabs--rail` turns `Tabs` into the vertical rail. `hf-arrow` is a text link with a drawn arrow.
- Phone gutter is `space-4`. Sections are `space-6` apart. Touch targets are at least 40px; the confirm button is 56px.
- Elevation is two soft shadows: the coupon's on the plaster, and `shadow-sheet` on the bottom sheet.

## States

- A status is a word in a ruled box, and the border carries it without colour: solid for done, dashed for pending, double for blocked or voided, hairline for an agent, dotted for unused. It must read in grayscale, because a projector washes colour out.
- There is no state icon set, by choice: states are words, and words are what a regulated state needs.
- Nothing disappears. A cancelled or refused order stays on screen, its total struck through, a large stamp across the perforation, and a one-line reason.
- A refused transaction shows its hash and reason.
- A blocked state is a `Notice` that says what to do: "Verify your identity in the wallet to trade."
- A pending registry report is a stamp reading "Report pending", never a spinner alone.
- Focus is a solid 2px `focus` ring with 2px offset on every interactive element.

## Motion

- One orchestrated moment. On load the ribbons drift in once. When a fill lands, the perforation lights left to right, the stub lets go and stays parted, and the stamp lands, all in `duration-tear`. Beyond that, only 150ms colour changes on hover and focus.
- `prefers-reduced-motion` removes all travel: the ribbons rest in place, the stub rests parted, and the stamp fades in so the sale still reads.
- `Sheet` ships as a static surface. Placement, scrim and dismissal belong to the app.

## Inside a host wallet

The wallet's brand owns the header and navigation. Handoff appears once, small, through `OperatedBy`: "Powered by Handoff". How far a host may restyle the coupon is still undecided.

## Components

`Button`, `Stamp`, `Amount`, `Hash`, `Fields`, `Coupon`, `AssetRow`, `TextField`, `PriceBand`, `Tabs`, `Notice`, `Sheet`, `FeedRow`, `OperatedBy` and `Ribbons` are in `components/`. Each folder has a README and a `preview.html`, and `index.d.ts` types the API.

## Logo

See `logos/README.md`. The mark is an H whose crossbar is a perforation. `OperatedBy` is the one exception to "never recolor": it takes the text color so the host's brand stays first.
