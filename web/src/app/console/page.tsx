import type { Metadata } from "next";
import { Console } from "./Console";
import "./console.css";

export const metadata: Metadata = { title: "Consola del emisor y PSAV | Handoff" };

export default function ConsolePage() {
  return <Console />;
}
