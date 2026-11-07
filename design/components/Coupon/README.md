The signature object. An order is a coupon with a stub, and it never disappears: it changes state. `open` shows the stub as unused. `sold` parts the stub from the coupon and shows the hash. `cancelled` and `reverted` strike the total, stamp across the perforation and carry a one-line `reason`.

Provide `label`, `title`, `total` and usually `fields` (four at most) with an optional `number` and `note`. Pass `torn` only at the moment a fill lands, so the tear plays once. A revert always shows its reason and hash; it is never hidden. Do not nest a coupon inside a coupon.
