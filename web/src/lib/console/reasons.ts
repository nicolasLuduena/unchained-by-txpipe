/** Reason codes in plain words. The code itself is always shown next to the sentence. */
const REASONS: Record<string, string> = {
  KumplyNotBusiness: "KUMPLY no devuelve atestación de empresa para esta dirección. Sin ella no opera como emisor.",
  KumplyUnavailable: "No pudimos leer la atestación en KUMPLY. Probá de nuevo en unos segundos.",
  IssuerNotBusiness: "El contrato rechazó el registro: esta dirección no tiene atestación de empresa.",
  MissingAuthorizationRef: "Falta la referencia de autorización de la CNV.",
  NotIssuer: "Solo el emisor del token puede hacer esto.",
  NotVenue: "Solo una plataforma habilitada para este token puede hacer esto.",
  NotIssuerOrVenue: "Solo el emisor o una plataforma habilitada pueden hacer esto.",
  NotAuthorized: "Solo el dueño del registro, el emisor o la plataforma anterior pueden re-apuntar.",
  NotOwner: "Solo el dueño del registro puede hacer esto.",
  UnknownToken: "Este token no está en el registro.",
  VenueCapReached: "El token ya tiene cinco plataformas. El contrato no admite una sexta.",
  VenueAlreadyListed: "Esa plataforma ya está en la lista.",
  VenueNotListed: "Esa plataforma no está en la lista.",
  ZeroAddress: "Falta una dirección.",
  SupplyExceeded: "Supera la cantidad autorizada de la emisión.",
  ReceiverNotAttested: "El receptor no tiene atestación válida en este token.",
  SenderNotAttested: "Quien transfiere no tiene atestación válida en este token.",
  SenderBlocked: "El titular está bloqueado.",
  TokenPaused: "El token está pausado.",
  InvalidBandWidth: "El ancho de banda no puede superar 10.000 puntos básicos.",
  ERC20InsufficientBalance: "El titular no tiene esas unidades.",
  PriceOutOfBand: "El precio está fuera de la banda.",
  PriceStale: "La referencia de precio venció.",
  BandNotSet: "El token todavía no tiene banda.",
  TradingDisabled: "El token no está abierto a negociación.",
  NotRoutedThroughVenue: "La transferencia no pasó por la liquidación de una plataforma.",
  KeyNotConfigured: "Este rol no tiene clave configurada en el servidor.",
  TransactionReverted: "La transacción se revirtió en la cadena.",
  SendFailed: "No pudimos enviar la transacción.",
  RouteUnavailable: "La ruta de envío de la consola no respondió.",
};

export function reasonText(code: string): string {
  return REASONS[code] ?? "La operación fue rechazada.";
}
