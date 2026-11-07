import type { Metadata } from "next";
import { Console } from "./Console";
import "./console.css";

export const metadata: Metadata = { title: "Issuer and PSAV console | Handoff" };

export default function ConsolePage() {
  return <Console />;
}
