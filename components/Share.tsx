"use client";

import { useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { formatName, slugify } from "@/lib/scene";
import { pathPrefix, type Variant } from "@/lib/variants";
import { celebrate } from "./celebrate";

type Made = { name: string; url: string; copied: boolean; status: "preparing" | "ready" };

// "Their name" + "Light their rocket": copies their link in the same click,
// launches a firework from the button, and renders their preview video right away
// so it plays in the chat they paste it into.
export function SendOn({ variant = "diwali" }: { variant?: Variant }) {
  const [value, setValue] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [nudge, setNudge] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const copy = (url: string) =>
    navigator.clipboard
      ? navigator.clipboard.writeText(url).then(() => true, () => false)
      : Promise.resolve(false);

  function light(e: React.FormEvent) {
    e.preventDefault();
    const name = formatName(value);
    if (!name) {
      setNudge(true);
      setTimeout(() => setNudge(false), 500);
      input.current?.focus();
      return;
    }
    const url = `${location.origin}${pathPrefix(variant)}/${encodeURIComponent(slugify(name))}`;
    // The clipboard write must start inside the click, before any await.
    const copied = copy(url);
    if (button.current) celebrate(button.current.getBoundingClientRect());
    track("rocket_lit", { variant });
    setMade({ name, url, copied: true, status: "preparing" });
    copied.then((ok) => setMade((m) => (m && m.url === url ? { ...m, copied: ok } : m)));
    fetch("/api/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, variant }) })
      .catch(() => {})
      .finally(() => setMade((m) => (m && m.url === url ? { ...m, status: "ready" } : m)));
  }

  const words = (variant === "meme" ? "Now send one to your gang" : "Now send one to someone you love").split(" ");
  return (
    <div className="send-on">
      <h2 aria-label={words.join(" ")}>
        {words.map((w, i) => (
          <span key={i} style={{ animationDelay: `${0.1 + i * 0.09}s` }}>
            {w}{" "}
          </span>
        ))}
      </h2>
      {!made ? (
        <form className={`maker${nudge ? " nudge" : ""}`} onSubmit={light}>
          <input ref={input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Their name" maxLength={24} aria-label="Their name" />
          <button ref={button} type="submit" className="btn">
            {variant === "meme" ? "Fire it to them" : "Light their rocket"}
          </button>
        </form>
      ) : (
        <div className="made" aria-live="polite">
          <p className="made-title">{made.copied ? `Link copied! Paste it to ${made.name} 💌` : `Here's ${made.name}'s link`}</p>
          <div className="made-row">
            <code>{made.url.replace(/^https?:\/\//, "")}</code>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <button className="btn" onClick={() => {
                  track("share");
                  navigator.share({ title: `Happy Diwali ${made.name}!`, url: made.url }).catch(() => {});
                }}>
                Share
              </button>
            ) : (
              <button className="btn ghost" onClick={() => {
                  track("copy");
                  copy(made.url).then((ok) => setMade({ ...made, copied: ok }));
                }}>
                Copy
              </button>
            )}
          </div>
          <p className="status">
            {made.status === "ready" ? (
              <>Their video preview is ready ✨ · <a href={made.url} target="_blank">Preview</a> · <button className="linkish" onClick={() => { setMade(null); setValue(""); }}>Send another</button></>
            ) : (
              <><span className="spark" /> Lighting {made.name}&apos;s video preview — give it a few seconds before sending</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
