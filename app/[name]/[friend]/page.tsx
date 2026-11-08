import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Player } from "@/components/Player";
import { SendOn } from "@/components/Share";
import { greetingMetadata } from "@/lib/meta";
import { formatName, slugify } from "@/lib/scene";
import { variantForPrefix } from "@/lib/variants";

// /2/justin: the first segment picks the greeting type (see lib/variants.ts).
type Props = { params: Promise<{ name: string; friend: string }> };

async function resolve(params: Props["params"]) {
  const { name: prefix, friend } = await params;
  const variant = variantForPrefix(prefix);
  if (!variant) notFound();
  return { variant, name: formatName(friend) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { variant, name } = await resolve(params);
  return greetingMetadata(name, slugify(name), variant);
}

export default async function TypedGreeting({ params }: Props) {
  const { variant, name } = await resolve(params);
  return (
    <main>
      <Player name={name} variant={variant}>
        <SendOn variant={variant} />
      </Player>
    </main>
  );
}
