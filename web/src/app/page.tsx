import { ACTORS, SECTIONS, type Section } from "./_wallet/nav";
import { WalletApp } from "./_wallet/WalletApp";
import "./_wallet/wallet.css";
import type { Actor } from "@/lib/sponsor";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function WalletPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, tab } = await searchParams;
  const selectedActor: Actor = ACTORS.find((a) => a.id === actor)?.id ?? "seller";
  const selectedSection: Section = SECTIONS.find((s) => s.id === tab)?.id ?? "mercado";
  return <WalletApp actor={selectedActor} section={selectedSection} />;
}
