One tokenized asset in the market list: an icon tile, the name in `body-strong`, a meta line in `caption`, the price in `amount` and an optional delta against issuance price. Rows are 64px, on `surface-raised`, separated by `line`.

Provide `name`, `price` (already formatted, Argentine decimal comma) and optionally `meta`, `delta` (with sign, the tone is inferred), `currency` (defaults to USDC), `icon` (a 20px stroke SVG) and `href` to make the row a link. Stack rows with `space-2` between them. Keep the meta line to one fact: holdings or issuance price, not both.
