---
name: Handoff
description: Every order is a coupon that validates, tears or voids, and nothing disappears.
colors:
  ground: "#141c2b"
  coupon: "#1f2a3d"
  stub: "#29364c"
  well: "#0f1522"
  text: "#e8dfcb"
  text-muted: "#beb7a6"
  rule: "#e8dfcb"
  rule-soft: "#3f4d66"
  amber: "#e9a23b"
  amber-bright: "#f4b65c"
  on-amber: "#141c2b"
  good: "#a8d3ad"
  bad: "#f08a78"
  focus: "#e9a23b"
typography:
  display-xl:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: "64px"
    letterSpacing: "0.01em"
  display-l:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "26px"
    letterSpacing: "0.04em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "18px"
    letterSpacing: "0.1em"
  button:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  button-lg:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  button-sm:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  tab:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  body-strong:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  field-label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.06em"
  figure-l:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: "48px"
    fontFeature: "'tnum' 1"
  figure:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "32px"
    fontFeature: "'tnum' 1"
  figure-s:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
    fontFeature: "'tnum' 1"
  input-figure:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum' 1"
  hash:
    fontFamily: "Spline Sans Mono, ui-monospace, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
rounded:
  radius: "0px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.on-amber}"
    typography: "{typography.button}"
    rounded: "{rounded.radius}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.amber-bright}"
  button-primary-lg:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.on-amber}"
    typography: "{typography.button-lg}"
    rounded: "{rounded.radius}"
    padding: "0 16px"
    height: "56px"
    width: "100%"
  button-secondary:
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.radius}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.stub}"
  button-secondary-sm:
    textColor: "{colors.text}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.radius}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.radius}"
    padding: "0 8px"
    height: "44px"
  button-danger:
    textColor: "{colors.bad}"
    typography: "{typography.button}"
    rounded: "{rounded.radius}"
    padding: "0 16px"
    height: "44px"
  stamp:
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.radius}"
    padding: "0 8px"
    height: "26px"
  stamp-good:
    textColor: "{colors.good}"
  stamp-bad:
    textColor: "{colors.bad}"
  stamp-unused:
    textColor: "{colors.text-muted}"
  coupon-body:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "16px 16px 24px"
  coupon-stub:
    backgroundColor: "{colors.stub}"
    textColor: "{colors.text}"
    padding: "12px 16px 16px"
  field:
    textColor: "{colors.amber}"
    typography: "{typography.figure}"
    padding: "8px 12px"
  asset-row:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "8px 16px"
    height: "64px"
  asset-row-hover:
    backgroundColor: "{colors.stub}"
  text-field:
    backgroundColor: "{colors.well}"
    textColor: "{colors.amber}"
    typography: "{typography.input-figure}"
    rounded: "{rounded.radius}"
    padding: "0 12px"
    height: "48px"
  price-band:
    textColor: "{colors.text}"
  tab:
    textColor: "{colors.text}"
    typography: "{typography.tab}"
    padding: "0 8px"
    height: "44px"
  tab-hover:
    textColor: "{colors.amber-bright}"
  tab-current:
    textColor: "{colors.amber}"
  notice:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "12px 16px"
  sheet:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    padding: "24px 16px 16px"
  feed-row:
    backgroundColor: "{colors.coupon}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    padding: "8px 16px"
    height: "48px"
---

> **Superseded in part.** The product moved to a light look: a plaster ground, indigo hairlines, indigo, madder and saffron ribbons, Montserrat and Jost. The current values live in `design/tokens.css`. The dark rules below describe the first version.

# Design System: Handoff

## Overview

**Creative North Star: "The Jet-Age Ticket Wallet"**

Handoff treats an order as a printed coupon kept in an old navy wallet. The coupon is cut stock: square at every corner, ruled with hairlines, headed in condensed capitals, and divided by a dashed perforation. It validates, tears or voids, and it stays on screen through all three. State is printed onto the object as a stamp. It is never a transient message that leaves.

The system is dense and exact, closer to a ledger than a marketing page. Colour is scarce: four navy grounds, one buff for text and rules, and one honey amber for value and action. Depth comes from stepping between stocks, so a single ambient shadow is enough for the whole system. Motion is scarcer still. One tear happens once, when a fill lands, and the rest of the system only changes colour.

The world rejects the fintech default of soft rounded cards with coloured pills. Screens are dark, with no white or near-white grounds. Inside a host wallet the wallet's brand comes first, and how far a host may restyle the coupon is still undecided.

**Key Characteristics:**
- Dark only: four navy stocks, buff text, honey amber for figures and the one action.
- Square corners throughout; the only curves are the notches at each end of the perforation.
- Status is a word in a ruled box, and the border style carries it without colour.
- Barlow Condensed capitals for heads, Barlow for text and tabular figures, Spline Sans Mono for hashes and addresses only.
- No icon set: states are words.
- One signature motion, the tear, played once.

## Colors

A low, cold navy range carries everything, with warm buff and honey amber printed on top of it.

### Primary
- **Honey Amber** (#e9a23b): The ink of value and action. Every figure, the current tab, the one primary fill, the stub head, the price band's position mark, the text caret and text selection.
- **Bright Honey** (#f4b65c): Hover only, on the primary fill and on tab text.
- **Navy on Amber** (#141c2b): Text on an amber fill, at 7.88:1. It shares Old Navy Serge's value but keeps its own role.
- **Focus Amber** (#e9a23b): The focus ring. It shares Honey Amber's value but keeps its own role.

### Secondary
- **Sage Stamp** (#a8d3ad): Done states: verified, sold, sponsored.
- **Coral Stamp** (#f08a78): Blocked, cancelled, reverted, error lines, the danger button, the invalid input border, and the out-of-band mark on the price band.

### Neutral
- **Old Navy Serge** (#141c2b): The wallet. Page and screen ground.
- **Coupon Stock** (#1f2a3d): Coupons, rows, notices and sheets.
- **Stub Stock** (#29364c): The part below a perforation, hover on rows and on every button except primary, and the working state of a button.
- **Inset Well** (#0f1522): Inputs only.
- **Buff** (#e8dfcb): Running text and titles. Passes 9.18:1 or better on all four grounds.
- **Worn Buff** (#beb7a6): Field labels, captions, secondary lines and voided figures. Passes 6.09:1 or better on all four grounds.
- **Buff Rule** (#e8dfcb): Lines that structure a coupon: field boxes, head rules, the perforation, input borders.
- **Soft Hairline** (#3f4d66): Row separators and the long edges of a coupon. Decorative at 1.43:1 to 2.14:1, so it never carries meaning alone.

### Named Rules
**The One Ink Rule.** Amber marks value and action, never decoration. On a product screen its only fill is the one primary action.

**The Word Not Fill Rule.** Sage and Coral never fill a surface. They ink a word, or stroke an outline or mark that sits with a word.

**The Dark Stock Rule.** Every screen sits on Old Navy Serge. No white or near-white ground, anywhere on screen.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif)
**Body Font:** Barlow (with system-ui, sans-serif)
**Label/Mono Font:** Spline Sans Mono (with ui-monospace, Menlo, monospace), for hashes and addresses only

**Character:** Condensed capitals give the coupon the voice of a printed ticket. Barlow shares that skeleton at normal width, so text and figures read as the same printer's work. All three families are self-hosted under the SIL OFL, so the system renders offline.

### Hierarchy
- **Display XL** (700, 64px, 64px line, 0.01em, uppercase): Slides and the catalog only.
- **Display L** (700, 44px, 46px line, 0.01em, uppercase): Coupon titles and console screen titles.
- **Title** (700, 22px, 26px line, 0.04em, uppercase): Sheet titles and subheads.
- **Label** (700, 14px, 18px line, 0.1em, uppercase): Coupon heads, stub heads and stamps.
- **Button** (700, 16px at medium, 22px at large, 14px at small, line-height 1, 0.08em, uppercase): All button text.
- **Tab** (700, 15px, line-height 1, 0.08em, uppercase): Navigation.
- **Body** (400, 15px, 22px line): Running text. Row names use **Body Strong** (600).
- **Caption** (400, 13px, 18px line): Helper lines, row meta and the demo caveat.
- **Field Label** (500, 12px, 16px line, 0.06em, uppercase, Barlow): Labels inside ruled fields and above inputs, in Worn Buff. This is the one uppercase style set at normal width.
- **Figure L / Figure / Figure S** (600; 44px on 48px, 26px on 32px, 15px on 20px; tabular numerals): The one headline figure, figures in ruled fields, figures in rows.
- **Input Figure** (600, 20px, line-height 1, tabular numerals): Values typed into an input.
- **Hash** (500, 13px, 18px line, Spline Sans Mono): Addresses and hashes, truncated as `0x8a1f…c42e`.

Figure S is weight 600 in `tokens.json` and in the Amount component.

### Named Rules
**The Tabular Figure Rule.** Figures are Barlow with tabular numerals, so columns of prices align. Every price, quantity and balance goes through the Amount component, written `USDC 112,00` with a decimal comma and a dot for thousands: `3.418,00`.

**The Hash Only Rule.** Spline Sans Mono sets hashes and addresses and nothing else, because that is where `0` and `O` must differ. It is not a figure face and not a code label.

**The Capitals Rule.** Barlow Condensed is always uppercase.

## Layout

The grid is a ruled ledger. Fields sit in a two-column grid and share their hairlines, so adjacent boxes never double a line. A coupon holds four fields at most.

Spacing runs on a seven-step scale from 4px to 48px. The phone gutter and coupon padding are 16px (`space-4`). Sections on a screen sit 24px apart (`space-5`), and major desktop blocks 48px apart (`space-7`). `space-6` (32px) is reserved for console section padding; no console is built yet, so treat that use as provisional.

The wallet screen is one column at phone width, and the catalog shows a coupon at its real size in a column up to 390px wide. Rows run edge to edge at 64px minimum, and feed rows at 48px minimum.

Components respond to their container, not the viewport. At 320px and below a coupon shrinks field figures to 21px, tightens field padding to 8px and keeps stub heads on one line. A feed row reflows from five columns to three at 620px, inside a container named `feed`.

Touch targets are at least 44px and the confirm button is 56px. Smaller visible controls reach that size with an extended hit area: the 36px small button reaches 46px, and a hash link reaches 44px.

## Elevation & Depth

The system is flat and uses tonal layering. Depth reads as stock on stock: Inset Well sits below Old Navy Serge, which sits below Coupon Stock, then Stub Stock. Only the bottom sheet lifts.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 -8px 32px rgba(8, 12, 20, 0.5)`): The bottom sheet only, cast upward.

### Named Rules
**The One Shadow Rule.** The sheet is the only surface that casts a shadow. Inset box-shadows on coupon edges and the current tab draw lines, not elevation, and they stay.

## Shapes

Every corner is square (0px). The only curves in the system are the 9px semicircular notches cut at each end of the perforation, which make the coupon read as a tearable object. They are cut with masks, so the ground shows through.

The perforation is a 2px dashed Buff Rule along the top of the stub. Soft Hairline holds the coupon's long edges so the stock survives a washed-out projector. On a sold coupon the stub drops 12px and its ground tilts -1.1 degrees, while its text stays level and crisp. A void stamp tilts -5 degrees across the perforation.

The mark is an H of two square bars, buff and amber, joined by a perforation instead of a crossbar.

### Named Rules
**The Cut Stock Rule.** Corners are square. A notch at the perforation is the only permitted curve.

**The Single Coupon Rule.** The coupon is the container. There are no generic cards, and coupons never nest.

## Components

### Buttons
Printed and blunt: a solid block of ink, or a ruled outline.
- **Shape:** Square corners (0px), 44px high, 56px and full width at large, 36px at small.
- **Primary:** Honey Amber fill with Navy on Amber text, once per screen.
- **Hover / Focus:** Primary lifts to Bright Honey; secondary, ghost and danger take Stub Stock behind them. Colour eases over 150ms. Focus is a solid 2px ring at 2px offset.
- **Secondary / Ghost / Danger:** Secondary is a Buff Rule outline. Ghost is underlined Buff text with 8px side padding. Danger is a Coral outline and word, for revoke and cancel only.
- **Disabled / Busy:** Disabled keeps its label in a 1px dashed Worn Buff outline. Busy sets a 1px dashed amber outline on Stub Stock and blocks clicks while signing.

### Stamps
A word in a ruled box, 26px high. It is not a button.
- **Style:** Square, label type, border in the current colour. Set in Spanish by default, and the word can change but never be removed.
- **State:** The border carries the state. Solid 2px for done (`verified`, `sold`, `sponsored`) in Sage. Dashed 2px for `pending` in Buff. Double 4px for `blocked`, `cancelled` and `reverted` in Coral. Solid 1px hairline for `agent` in Buff, which keeps agent quotes apart from human orders. Dotted 1px for `unused` in Worn Buff.

### Coupon
The signature object: an order with a stub.
- **Corner Style:** Square, with 9px notches at the perforation.
- **Background:** Coupon Stock above the perforation, Stub Stock below it.
- **Shadow Strategy:** None; see Elevation & Depth.
- **Border:** Soft Hairline long edges, a Buff Rule under the head, and the dashed perforation.
- **Internal Padding:** 16px, with 24px below the body; the stub is 12px above and 16px at the sides and bottom.
- **Anatomy:** A head with label and optional serial number, a Display L title, up to four ruled fields, an optional note, then a stub with an amber head, a stamp, the total and any proof lines.
- **Open:** The stub is attached and stamped `unused`.
- **Sold:** The stub rests parted and shows the hash.
- **Cancelled / Reverted:** Figures fall to Worn Buff, the stub total is struck through at 2px, a 38px stamp crosses the perforation, and a one-line reason stays. A revert shows its hash too.
- **The tear:** When a fill lands the stub parts and tilts over 420ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and the stamp lands from 1.6 scale after a 160ms delay. Under reduced motion the animation is removed and the stub still rests parted.

### Rows
- **Asset row:** Coupon Stock, 64px minimum, separated by Soft Hairline. Name in Body Strong, one meta fact in Caption, and on the right an Amount with an optional stamp. Linked rows take Stub Stock on hover. There is no icon tile.
- **Feed row:** One line of the compliance feed on Coupon Stock: time, event stamp, asset, counterparties labelled "Vende" and "Compra", and price.

### Inputs / Fields
- **Style:** Inset Well with a 1px Buff Rule border, square, 48px high. Typed figures are amber, and the caret is amber.
- **Focus:** Solid 2px Focus Amber ring at 2px offset.
- **Error / Disabled:** Error sets a 2px Coral border and a Coral help line saying how to fix it. Disabled dashes the border and drops the value to Worn Buff.

### Price Band
The allowed range, drawn to scale: a 2px Buff Rule line with end ticks and a 3px by 20px amber mark at the true position. The value reads below in amber, with the ends in Buff. Outside the band the mark holds the edge and turns Coral, and the readout adds "Fuera de banda", so the state survives without colour.

### Navigation
Tabs in condensed capitals, 44px minimum, Buff at rest with Bright Honey text on hover. The current tab is amber with a 2px amber underline and `aria-current`. In a host wallet the host owns navigation, and these tabs serve only screens Handoff owns.

### Notice
A stamp and one sentence on Coupon Stock inside a 1px Buff Rule box: what happened and what to do next. A blocked notice is announced as an alert.

### Sheet
The confirmation surface: Coupon Stock with a Buff Rule top edge and the one shadow. It holds at most one primary button, plus the demo caveat when it shows an attestation. The component ships the surface only; placement, scrim and dismissal are not built.

### Operated By
Handoff's one appearance inside a host wallet: the mark at 24px and "Operado con Handoff" in Caption, once per screen, in the footer. It takes the surrounding text colour so the host's brand stays first.

### Named Rules
**The Nothing Disappears Rule.** An order changes state and stays on screen. Cancelled and reverted orders keep their coupon, their stamp and their reason.

**The Grayscale Rule.** A status must read in grayscale, because a projector washes colour out. If the border style and the word do not carry it, it is not finished.

**The One Tear Rule.** The tear is the only signature motion, and it plays once, at the moment a fill lands. Everything else only changes colour.

## Do's and Don'ts

### Do:
- **Do** ground every screen on Old Navy Serge and put coupons, rows, notices and sheets on Coupon Stock.
- **Do** use the tokens, never a literal colour. Edit `tokens.json` and regenerate `tokens.css`.
- **Do** send every price, quantity and balance through Amount, and every address and hash through Hash.
- **Do** write a status as a word in a ruled box, with the border style from the stamp ladder.
- **Do** keep a cancelled or reverted coupon on screen with its struck total, its stamp across the perforation and a one-line reason.
- **Do** give every interactive element a solid 2px focus ring at 2px offset.
- **Do** keep touch targets at 44px or more, and the confirm button at 56px.
- **Do** show the Fuji demo caveat in Caption on every screen with an attestation.
- **Do** pass `torn` only at the moment a fill lands, and keep the stub parted under reduced motion.

### Don't:
- **Don't** use white or near-white grounds.
- **Don't** use soft rounded cards or coloured pills. Corners are square, and a status is a stamp.
- **Don't** put two primary buttons on one screen.
- **Don't** use Sage or Coral as a surface fill.
- **Don't** set anything in Spline Sans Mono except hashes and addresses, including figures and token labels.
- **Don't** add an icon set, or use a spinner alone for a pending state.
- **Don't** nest a coupon inside a coupon.
- **Don't** lift the coupon head onto page sections as a small label above a heading. It is ruled ticket data and belongs to the coupon.
- **Don't** add a shadow to anything but the sheet.
- **Don't** animate anything beyond the tear and colour changes on hover and focus.
- **Don't** recolor, rotate, outline or add effects to the logo files. Operated By is the one exception, taking the surrounding text colour inside a host wallet.
