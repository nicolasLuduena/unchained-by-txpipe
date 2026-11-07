import { Landing } from "./_landing/Landing";
import { ACTORS, SECTIONS, type Section } from "./_wallet/nav";
import { WalletApp } from "./_wallet/WalletApp";
import "./_wallet/wallet.css";
import type { Actor } from "@/lib/sponsor";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The bare address is the landing page. Every link into the wallet names an actor, so old wallet links keep working. */
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, tab } = await searchParams;
  if (actor === undefined && tab === undefined) return <Landing />;
  const selectedActor: Actor = ACTORS.find((a) => a.id === actor)?.id ?? "seller";
  const selectedSection: Section = SECTIONS.find((s) => s.id === tab)?.id ?? "mercado";
  return <WalletApp actor={selectedActor} section={selectedSection} />;
}
