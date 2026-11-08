"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { sceneSize, type Orientation } from "@/lib/scene";
import { SCENES } from "@/lib/scenes";
import type { Variant } from "@/lib/variants";

const fonts = new Map<string, Promise<void>>();
function loadFont(family: string, file: string) {
  let f = fonts.get(family);
  if (!f) {
    f = new FontFace(family, `url(/fonts/${file})`).load().then((face) => void document.fonts.add(face));
    fonts.set(family, f);
  }
  return f;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

// Plays the same scene the OG video is rendered from (portrait on phones where
// the scene has a portrait layout). After the wish, `children` (the "send one"
// form) is revealed over or below the scene. Click the scene to replay.
export function Player({ name, variant = "diwali", children }: { name: string; variant?: Variant; children?: ReactNode }) {
  const def = SCENES[variant];
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef(0);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ctaTop, setCtaTop] = useState(66);

  useEffect(() => {
    const phone = matchMedia("(max-width: 759px) and (orientation: portrait)").matches;
    setOrientation(def.portrait && phone ? "portrait" : "landscape");
  }, [def]);

  useEffect(() => {
    if (!orientation) return;
    let raf = 0;
    let cancelled = false;
    let shown = false;
    Promise.all([Promise.all(def.images(orientation).map(loadImage)), Promise.all(def.fonts.map(([f, file]) => loadFont(f, file)))]).then(([imgs]) => {
      if (cancelled || !ref.current) return;
      const factory = (w: number, h: number) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      };
      const scene = def.create(name, factory, imgs, orientation);
      // scenes either settle after their first play, or loop from `loopFrom`
      const { loopFrom, duration } = def;
      const clock = (t: number) => (loopFrom !== undefined && t > duration ? loopFrom + ((t - loopFrom) % (duration - loopFrom)) : t);
      setCtaTop(((scene.textBottom + 30) / sceneSize(orientation).h) * 100);
      const ctx = ref.current.getContext("2d")!;
      start.current = performance.now();
      const tick = (now: number) => {
        const t = (now - start.current) / 1000;
        if (!shown && t >= def.cta) {
          shown = true;
          setRevealed(true);
        }
        scene.draw(ctx, clock(t));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [name, orientation, def]);

  const size = sceneSize(orientation ?? "landscape");
  return (
    <div className={`player ${orientation ?? "landscape"}${def.overlay ? "" : " below"}`} style={{ "--cta-top": `${ctaTop}%` } as CSSProperties}>
      <div className="stage" style={{ aspectRatio: `${size.w} / ${size.h}` }} onClick={() => (start.current = performance.now())} title="Replay">
        <canvas ref={ref} width={size.w} height={size.h} aria-label={`Happy Diwali ${name}`} role="img" />
      </div>
      {children && <div className={`cta${revealed ? " on" : ""}`}>{children}</div>}
    </div>
  );
}
