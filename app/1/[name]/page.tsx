import type { Metadata } from "next";
import { Player } from "@/components/Player";
import { SendOn } from "@/components/Share";
import { greetingMetadata } from "@/lib/meta";
import { formatName, slugify } from "@/lib/scene";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = formatName((await params).name);
  return greetingMetadata(name, slugify(name), "meme");
}

export default async function MemeGreeting({ params }: Props) {
  const name = formatName((await params).name);
  return (
    <main>
      <Player name={name} variant="meme">
        <SendOn variant="meme" />
      </Player>
    </main>
  );
}
