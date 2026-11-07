import { networkLabel } from "@/lib/chain";
/** Reason codes in plain words. The code itself is always shown next to the sentence. */
const REASONS: Record<string, string> = {
  buyer_blocked: "The PSAV will not co-sign: the buyer's account is blocked.",
  nonce_used: "This order repeats a nonce that was already used.",
  buyer_not_attested: "The PSAV will not co-sign: the buyer's account is not verified.",
  NotBusiness: "This address has no business attestation. Without one it cannot act as an issuer.",
  BusinessReadFailed: "We could not read the attestation. Try again in a few seconds.",
  IssuerNotBusiness: "The contract refused the registration: this address has no business attestation.",
  MissingAuthorizationRef: "The CNV authorization reference is missing.",
  NotIssuer: "Only the token's issuer can do this.",
  NotVenue: "Only a venue enabled for this token can do this.",
  NotIssuerOrVenue: "Only the issuer or an enabled venue can do this.",
  NotAuthorized: "Only the registry owner, the issuer or the previous venue can repoint.",
  NotOwner: "Only the registry owner can do this.",
  UnknownToken: "This token is not in the registry.",
  VenueCapReached: "This token already has five venues. The contract does not allow a sixth.",
  VenueAlreadyListed: "That venue is already on the list.",
  VenueNotListed: "That venue is not on the list.",
  ZeroAddress: "An address is missing.",
  SupplyExceeded: "This goes over the units authorized for the issuance.",
  ReceiverNotAttested: "The receiver has no valid attestation for this token.",
  SenderNotAttested: "The sender has no valid attestation for this token.",
  SenderBlocked: "The holder is blocked.",
  TokenPaused: "The token is paused.",
  InvalidBandWidth: "The price band width cannot go over 10,000 basis points.",
  ERC20InsufficientBalance: "The holder does not have those units.",
  PriceOutOfBand: "The price is outside the price band.",
  PriceStale: "The reference price has expired.",
  BandNotSet: "This token has no price band yet.",
  TradingDisabled: "This token is not open for trading.",
  NotRoutedThroughVenue: "The transfer did not go through a venue's settlement.",
  KeyNotConfigured: "This role has no key available on the server.",
  TransactionReverted: `The transaction reverted on ${networkLabel}.`,
  SendFailed: "We could not send the transaction.",
  RouteUnavailable: "The console's send route did not respond.",
};

export function reasonText(code: string): string {
  return REASONS[code] ?? "The operation was refused.";
}
