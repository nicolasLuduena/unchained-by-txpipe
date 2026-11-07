import type { Address, Hash } from "viem";

export type FillReport = {
  orderHash: Hash;
  txHash: Hash;
  token: Address;
  seller: Address;
  buyer: Address;
  amount: bigint;
  price: bigint;
};

export type Acknowledgment = {
  id: string;
  /** Says what the acknowledgment is. A mock must say it is a mock. */
  label: string;
  at: string;
};

/** The surface a BYMA Token Registry client would implement. */
export interface RegistryReport {
  report(fill: FillReport): Promise<Acknowledgment>;
}

const DEMO_LATENCY_MS = 1200;

/** No live call happens. The delay only lets the pending state show, as it would against a real registry. */
const fakeRegistryReport: RegistryReport = {
  async report(fill) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));
    return {
      id: `DEMO-${fill.txHash.slice(2, 10).toUpperCase()}`,
      label: "Acuse de demostración, sin llamada real",
      at: new Date().toISOString(),
    };
  },
};

export const registryReport: RegistryReport = fakeRegistryReport;
