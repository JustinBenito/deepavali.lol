// The scene behind each greeting type: how long it runs, which fonts and images
// it needs, and how to build it. Used by the browser player and the server renderer.
import type { MakeCanvas, Scene } from "../kit";
import { createMemeScene, FONT_MEME, HERO_URL, MEME_CTA_TIME, MEME_DURATION, MEME_POSTER_TIME, SKY_URL } from "../meme";
import { BACKDROPS, createScene, CTA_TIME, DURATION, FONT_HEAVY, FONT_SEMI, POSTER_TIME, type Orientation } from "../scene";
import type { Variant } from "../variants";
import { createDhamakaScene, DHAMAKA, FONT_COMIC } from "./dhamaka";
import { createDiyaScene, DIYA, FONT_SCRIPT } from "./diya";
import { createMithaiScene, MITHAI, SWEETS_URL } from "./mithai";
import { createRangoliScene, RANGOLI } from "./rangoli";
import { createSparklerScene, SPARKLER } from "./sparkler";

export type SceneDef = {
  duration: number; // seconds of video
  poster: number; // frame used for og:image
  cta: number; // when the page reveals the "their name" form
  fonts: [family: string, file: string][]; // files in public/fonts
  images: (o: Orientation) => string[]; // public URLs, passed to create() in order
  create(name: string, makeCanvas: MakeCanvas, images: (CanvasImageSource | undefined)[], o: Orientation): Scene;
  portrait?: boolean; // has a portrait layout for phones
  overlay?: boolean; // form sits over the scene (else below it)
  loopFrom?: number; // on the page, keep replaying from here after the first play
};

const POPPINS: SceneDef["fonts"] = [
  [FONT_HEAVY, "Poppins-ExtraBold.ttf"],
  [FONT_SEMI, "Poppins-SemiBold.ttf"],
];
const SCRIPT: SceneDef["fonts"][number] = [FONT_SCRIPT, "GreatVibes-Regular.ttf"];

export const SCENES: Record<Variant, SceneDef> = {
  diwali: {
    duration: DURATION,
    poster: POSTER_TIME,
    cta: CTA_TIME,
    fonts: POPPINS,
    images: (o) => [BACKDROPS[o].url],
    create: (name, mk, [bg], o) => createScene(name, mk, bg, o),
    portrait: true,
    overlay: true,
  },
  meme: {
    duration: MEME_DURATION,
    poster: MEME_POSTER_TIME,
    cta: MEME_CTA_TIME,
    fonts: [[FONT_MEME, "Bungee-Regular.ttf"]],
    images: () => [HERO_URL, SKY_URL],
    create: (name, mk, [hero, sky]) => createMemeScene(name, mk, hero, sky),
    loopFrom: 1,
  },
  diya: { ...DIYA, fonts: [SCRIPT, POPPINS[1]], images: () => [], create: (name, mk) => createDiyaScene(name, mk) },
  rangoli: { ...RANGOLI, fonts: [SCRIPT, ...POPPINS], images: () => [], create: (name, mk) => createRangoliScene(name, mk) },
  sparkler: { ...SPARKLER, fonts: [SCRIPT], images: () => [], create: (name, mk) => createSparklerScene(name, mk) },
  mithai: { ...MITHAI, fonts: [SCRIPT, ...POPPINS], images: () => [SWEETS_URL], create: (name, mk, [atlas]) => createMithaiScene(name, mk, atlas) },
  dhamaka: { ...DHAMAKA, fonts: [[FONT_COMIC, "Bangers-Regular.ttf"]], images: () => [], create: (name, mk) => createDhamakaScene(name, mk) },
};
