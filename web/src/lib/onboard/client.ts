import type { Address, Hex } from "viem";
import { VenueRefusal } from "@/lib/orders/client";
import type { AccountView, OnboardRecord } from "./types";

async function call<T>(init?: RequestInit, query = ""): Promise<T> {
  const response = await fetch(`/api/onboard${query}`, { cache: "no-store", ...init });
  const json = await response.json();
  if (!response.ok) throw new VenueRefusal(json.error?.code ?? "unavailable", json.error?.reason ?? "El servicio de verificación no pudo responder.");
  return json as T;
}

export const onboarding = {
  account: (owner: Address) => call<AccountView>(undefined, `?owner=${owner}`),
  request: (owner: Address, signature: Hex) =>
    call<{ record: OnboardRecord }>({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, signature }) }).then((r) => r.record),
};
