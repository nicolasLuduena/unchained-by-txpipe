import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";
import "../_wallet/wallet.css";
import "../console/console.css";
import "./demo.css";

export const metadata: Metadata = { title: "Guided demo | Handoff" };

/** The jury's view: a guided walkthrough of two host wallets and the compliance feed. `#all` shows it all at once. */
export default function DemoPage() {
  return <DemoApp />;
}
