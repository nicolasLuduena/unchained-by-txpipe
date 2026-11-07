import type { Metadata } from "next";
import { DemoApp } from "./DemoApp";
import "../_wallet/wallet.css";
import "../console/console.css";
import "./demo.css";

export const metadata: Metadata = { title: "Dos billeteras, un libro | Handoff" };

/** The jury's view: two host wallets on one shared order set, beside the compliance feed. */
export default function DemoPage() {
  return <DemoApp />;
}
