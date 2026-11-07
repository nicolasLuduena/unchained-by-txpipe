const BPS = 10_000n;

/** The same arithmetic as HandoffSettlement._checkBand, so the screen and the chain agree at the edges. */
export function bandLimits(band: { price: bigint; widthBps: number }, floor: bigint) {
  const width = BigInt(band.widthBps);
  const low = (band.price * (BPS - width)) / BPS;
  return { low: low < floor ? floor : low, high: (band.price * (BPS + width)) / BPS };
}
