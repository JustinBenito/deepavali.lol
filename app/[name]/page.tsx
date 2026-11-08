import type { Metadata } from "next";
import { Player } from "@/components/Player";
import { SendOn } from "@/components/Share";
import { greetingMetadata } from "@/lib/meta";
import { formatName, slugify } from "@/lib/scene";
import { variantForPrefix, type Variant } from "@/lib/variants";

type Props = { params: Promise<{ name: string }> };

// /justin is the default greeting; /2 on its own is the home of the type at /2.
async function resolve(params: Props["params"]): Promise<{ variant: Variant; name: string; slug: string }> {
  const { name: raw } = await params;
  const typed = variantForPrefix(raw);
  if (typed) return { variant: typed, name: "Everyone", slug: "" };
  const name = formatName(raw);
  return { variant: "diwali", name, slug: slugify(name) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { variant, name, slug } = await resolve(params);
  return greetingMetadata(name, slug, variant);
}

export default async function Greeting({ params }: Props) {
  const { variant, name } = await resolve(params);
  return (
    <main>
      <Player name={name} variant={variant}>
        <SendOn variant={variant} />
      </Player>
    </main>
  );
}
