"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createMemeScene, FONT_MEME, HERO_URL, MEME_CTA_TIME, MEME_DURATION, SKY_URL } from "@/lib/meme";
import type { Variant } from "@/lib/variants";
import { BACKDROPS, createScene, CTA_TIME, FONT_HEAVY, FONT_SEMI, sceneSize, type Orientation } from "@/lib/scene";

const fonts = new Map<string, Promise<void>>();
function loadFont(family: string, url: string) {
  let f = fonts.get(family);
  if (!f) {
    f = new FontFace(family, `url(${url})`).load().then((face) => void document.fonts.add(face));
    fonts.set(family, f);
  }
  return f;
}
function loadFonts(variant: Variant) {
  return variant === "meme"
    ? loadFont(FONT_MEME, "/fonts/Bungee-Regular.ttf")
    : Promise.all([loadFont(FONT_HEAVY, "/fonts/Poppins-ExtraBold.ttf"), loadFont(FONT_SEMI, "/fonts/Poppins-SemiBold.ttf")]);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

// Plays the same scene the OG video is rendered from (portrait on phones). After
// the wish, `children` (the "send one" form) is revealed over the scene; the scene
// then settles into a calm end state instead of looping. Click the scene to replay.
export function Player({ name, variant = "diwali", children }: { name: string; variant?: Variant; children?: ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const start = useRef(0);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ctaTop, setCtaTop] = useState(66);

  useEffect(() => {
    // The meme is landscape-only; the rocket scene goes portrait on phones.
    const phone = matchMedia("(max-width: 759px) and (orientation: portrait)").matches;
    setOrientation(variant === "diwali" && phone ? "portrait" : "landscape");
  }, [variant]);

  useEffect(() => {
    if (!orientation) return;
    let raf = 0;
    let cancelled = false;
    let shown = false;
    const images = variant === "meme" ? [HERO_URL, SKY_URL] : [BACKDROPS[orientation].url];
    Promise.all([Promise.all(images.map(loadImage)), loadFonts(variant)]).then(([[img, sky]]) => {
      if (cancelled || !ref.current) return;
      const factory = (w: number, h: number) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      };
      const scene = variant === "meme" ? createMemeScene(name, factory, img, sky) : createScene(name, factory, img, orientation);
      const ctaTime = variant === "meme" ? MEME_CTA_TIME : CTA_TIME;
      // the meme keeps firing: after its first play, loop the gunfire
      const clock = (t: number) => (variant === "meme" && t > MEME_DURATION + 1 ? 1 + ((t - 1) % MEME_DURATION) : t);
      setCtaTop(((scene.textBottom + 30) / sceneSize(orientation).h) * 100);
      const ctx = ref.current.getContext("2d")!;
      start.current = performance.now();
      const tick = (now: number) => {
        const t = (now - start.current) / 1000;
        if (!shown && t >= ctaTime) {
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
  }, [name, orientation, variant]);

  const size = sceneSize(orientation ?? "landscape");
  return (
    <div className={`player ${orientation ?? "landscape"}${variant === "meme" ? " below" : ""}`} style={{ "--cta-top": `${ctaTop}%` } as CSSProperties}>
      <div className="stage" style={{ aspectRatio: `${size.w} / ${size.h}` }} onClick={() => (start.current = performance.now())} title="Replay">
        <canvas ref={ref} width={size.w} height={size.h} aria-label={`Happy Diwali ${name}`} role="img" />
      </div>
      {children && <div className={`cta${revealed ? " on" : ""}`}>{children}</div>}
    </div>
  );
}
