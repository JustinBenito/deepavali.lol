import type { Metadata } from "next";
import { Player } from "@/components/Player";
import { SendOn } from "@/components/Share";
import { greetingMetadata } from "@/lib/meta";

export function generateMetadata(): Promise<Metadata> {
  return greetingMetadata("Everyone", "");
}

export default function Home() {
  return (
    <main>
      <Player name="Everyone">
        <SendOn />
      </Player>
    </main>
  );
}
