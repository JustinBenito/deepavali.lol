# deepavali.lol

Personalised Diwali greetings whose **link preview is a video**. Share
`deepavali.lol/justin` and the chat shows a rocket launching from a rooftop,
bursting, and its sparks forming **Happy Diwali Justin**.

| URL | What you get |
| --- | --- |
| `deepavali.lol/<name>` | The rocket greeting: launch, zoom-out, burst, sparks form the wish |
| `deepavali.lol/1/<name>` | The meme: poster lettering and a fan of guns firing festive tracers |
| `deepavali.lol/2/<name>` | Diya: a single diya lights up, the wish revealed in gold script |
| `deepavali.lol/3/<name>` | Rangoli: a mandala pours itself ring by ring in coloured powder |
| `deepavali.lol/4/<name>` | Sparkler: the wish written in light, sparks flying |
| `deepavali.lol/5/<name>` | Mithai: a wreath of twenty Diwali sweets pops in around the wish |
| `deepavali.lol/6/<name>` | Dhamaka: a comic-book ladi goes off, BOOM! bubbles, title slam |

`deepavali.lol/2` (no name) shows that style for "Everyone".

After the wish plays, the page asks for *their name*. One click copies their
link, fires a burst of fireworks from the button, and renders their preview
video before they paste it anywhere.

## How it works

```
/justin  ──▶  page metadata: og:video + og:image (stored file if it exists, else /og/…)
/og/justin.mp4
   └─▶ already rendered?  ──yes──▶  308 to R2 public URL (CDN, range requests)
          │ no
          ▼
       split frames into 12 chunks ──▶ /api/chunk × 12 in parallel
       (each draws frames with @napi-rs/canvas → H.264 segment via ffmpeg)
          ▼
       join segments (no re-encode) ──▶ upload to R2 ──▶ respond
```

- **One scene, two renderers.** Every frame is a pure function of time
  (`draw(ctx, t)`), so the server renders the OG video frame by frame and the
  browser plays the exact same scene live on a `<canvas>`.
- **Render once, ever.** Files are stored in Cloudflare R2 by version and name;
  a new name takes ~4s, every request after that is a redirect.
- **Fast cold renders.** A video is cut into 12 frame ranges rendered by
  parallel function invocations, then joined with ffmpeg's concat demuxer.
- **Keeps working if storage fails.** It renders on demand, keeps recent
  files in memory, and lets the CDN cache responses.
- **Ready before it's shared.** "Light their rocket" calls `/api/prepare`, so
  the video exists by the time the link is pasted.
- **Phones get a portrait scene** with its own painted backdrop; the OG video
  is always 16:9.

### Files

```
lib/variants.ts      every greeting type: URL prefix, preview text, form copy
lib/scenes/index.ts  every type's scene: duration, fonts, images, constructor
lib/scenes/*.ts      diya, rangoli, sparkler, mithai, dhamaka
lib/kit.ts           shared helpers for scenes (seeded random, easing, glows, text fit)
lib/scene.ts         the rocket greeting (landscape + portrait layouts)
lib/meme.ts          the /1 meme
lib/render.ts        server rendering: fonts, assets, frames → ffmpeg
lib/og.ts            storage lookup, parallel chunk rendering, dedupe, fallback
lib/store.ts         Cloudflare R2 (S3 API)
lib/meta.ts          Open Graph / Twitter tags
components/Player    plays a scene in the browser, reveals the "send one" form
components/Share     their name → copy link + fireworks + prepare preview
app/[name]/…         /<name> and /<prefix>/<name> pages
app/og/[...path]     the og:video / og:image endpoints for every type
app/api/chunk        renders one slice of frames (HMAC-signed, internal)
app/api/prepare      renders a name's image + video ahead of sharing
```

## Add a new greeting type

Say you want `deepavali.lol/7/<name>`. It takes three files; routes, OG images,
video rendering, storage and the send form pick it up from the registry.

**1. Write the scene**: `lib/scenes/confetti.ts`. A scene is a function of time:

```ts
import { seeded, W, H, type Ctx, type MakeCanvas, type Scene } from "../kit";

export const CONFETTI = { duration: 6, poster: 4.5, cta: 4 }; // seconds: video length, og:image frame, form reveal
export const FONT_COMIC = "DeepComic";

export function createConfettiScene(name: string, makeCanvas: MakeCanvas): Scene {
  const rand = seeded("confetti:" + name.toLowerCase()); // never Math.random()
  // precompute anything expensive here: text layouts, sprites, particle paths
  function draw(ctx: Ctx, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // draw the 1280×720 frame at time t, without depending on the previous frame
  }
  return { draw, name, textBottom: 480 };
}
```

`draw(ctx, t)` must be deterministic: the same name and `t` give the same pixels.
The server renders a video as 12 chunks in parallel, so any frame has to be
drawable on its own. Look at `lib/scenes/sparkler.ts` (particles spawned on a
fixed timeline), `lib/scenes/dhamaka.ts` (events at set times) or
`lib/scenes/mithai.ts` (drawing from an image atlas) for patterns.

**2. Register the type** in `lib/variants.ts`:

```ts
export const VARIANTS = [..., "confetti"] as const;

confetti: {
  prefix: "7",
  emoji: "🎉",
  blurb: "Confetti for you! Send some at {site}", // link preview description
  ask: "Throw confetti at someone",               // heading over the form
  button: "Throw it",
},
```

**3. Register the scene** in `lib/scenes/index.ts`:

```ts
confetti: {
  ...CONFETTI,
  fonts: [[FONT_COMIC, "Bangers-Regular.ttf"]],  // files in public/fonts
  images: () => [],                              // public URLs, e.g. ["/confetti/bg.jpg"]
  create: (name, mk) => createConfettiScene(name, mk),
},
```

Put new fonts in `public/fonts/`. Put images in a `public/` folder and add that
folder to `renderAssets` in `next.config.ts`, so serverless functions bundle it.

Optional: `loopFrom` keeps the page animation looping (the meme uses it),
`portrait` and `overlay` are how the rocket greeting gets its phone layout and
its form over the scene.

> Changed how an existing type looks? Bump `RENDER_VERSION` in `lib/render.ts`
> so stored videos are re-rendered instead of reused.

## Run it

```bash
npm install          # downloads a static ffmpeg build (ffmpeg-static)
npm run dev
```

Open `http://localhost:3000/yourname` for the page and
`http://localhost:3000/og/yourname.mp4` for the preview video.

Without storage env vars everything still works: files are rendered in one
process and kept in memory.

### Environment

| Variable | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token (Object Read & Write on the bucket) |
| `R2_BUCKET` | bucket name |
| `R2_PUBLIC_URL` | the bucket's public URL (custom domain or `r2.dev`), no trailing slash |
| `OG_CHUNK_SECRET` | random string that signs internal `/api/chunk` calls |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | optional, lets chunk calls through Deployment Protection |

Nothing is tied to a domain: URLs come from the request host, so the same build
works on localhost, preview deployments and any custom domain.

## Deploy

Built for Vercel (Node.js functions, Fluid compute):

```bash
vercel deploy --prod
```

## License

[MIT](LICENSE). Built with bright light, a try by [LGS](https://limegreen.studio).
