import type { Metadata } from "next";
import { Player } from "@/components/Player";
import { SendOn } from "@/components/Share";
import { greetingMetadata } from "@/lib/meta";

export function generateMetadata(): Promise<Metadata> {
  return greetingMetadata("Everyone", "", "meme");
}

export default function MemeHome() {
  return (
    <main>
      <Player name="Everyone" variant="meme">
        <SendOn variant="meme" />
      </Player>
    </main>
  );
}
