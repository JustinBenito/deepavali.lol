# deepavali.lol

Personalised Diwali greetings whose **link preview is a video**. Share
`deepavali.lol/justin` and the chat shows a rocket launching from a rooftop,
bursting, and its sparks forming **Happy Diwali Justin**.

| URL | What you get |
| --- | --- |
| `deepavali.lol/<name>` | The rocket greeting: launch, zoom-out, burst, sparks form the wish |
| `deepavali.lol/1/<name>` | The meme: poster lettering and a fan of guns firing festive tracers |

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
lib/variants.ts      every greeting type and its URL prefix
lib/scene.ts         the rocket greeting (landscape + portrait layouts)
lib/meme.ts          the /1 meme
lib/render.ts        server rendering: fonts, assets, frames → ffmpeg
lib/og.ts            storage lookup, parallel chunk rendering, dedupe, fallback
lib/store.ts         Cloudflare R2 (S3 API)
lib/meta.ts          Open Graph / Twitter tags
components/Player    plays a scene in the browser, reveals the "send one" form
components/Share     their name → copy link + fireworks + prepare preview
app/og/…/route.ts    the og:video / og:image endpoints
app/api/chunk        renders one slice of frames (HMAC-signed, internal)
app/api/prepare      renders a name's image + video ahead of sharing
```

## Add a new greeting type

Say you want `deepavali.lol/2/<name>`.

**1. Write the scene**: `lib/sparkler.ts`. A scene is just a function of time:

```ts
export const SPARKLER_DURATION = 6;    // seconds of video
export const SPARKLER_POSTER_TIME = 4; // frame used for og:image
export const SPARKLER_CTA_TIME = 3.5;  // when the page reveals the form

export function createSparklerScene(name: string, makeCanvas: CanvasFactory, ...assets: CanvasImageSource[]) {
  // precompute anything expensive here (text layouts, sprites, particle paths)
  function draw(ctx: CanvasRenderingContext2D, t: number, scale = 1) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // draw the 1280×720 frame at time t; never depend on the previous frame
  }
  return { draw, name, textBottom: 720 };
}
```

Keep `draw` deterministic: same name and `t`, same pixels. Use a seeded random
(see `mulberry32` in `lib/scene.ts`), never `Math.random()`. Each chunk renders
its frames independently.

**2. Register it** in `lib/variants.ts`:

```ts
export const VARIANTS = ["diwali", "meme", "sparkler"] as const;
export const PREFIX = { diwali: "", meme: "1", sparkler: "2" };
```

**3. Teach the server to render it** in `lib/render.ts`:

- add `sparkler: { duration: SPARKLER_DURATION, poster: SPARKLER_POSTER_TIME }` to `TIMING`
- add a branch in `makeScene` that loads its assets with `publicImage(...)`
- register any new font in `ensureFonts`

Put images in `public/<something>/` and add that folder to `renderAssets` in
`next.config.ts`, so serverless functions bundle it.

**4. Teach the browser to play it** in `components/Player.tsx`. Add its images,
font and `createSparklerScene` to the branches that pick assets and build the scene.

**5. Add the routes.** Copy the meme ones and change the variant:

```
app/2/[name]/page.tsx       → greetingMetadata(name, slug, "sparkler"), <Player variant="sparkler">, <SendOn variant="sparkler">
app/og/2/[file]/route.ts    → ogResponse(req, file, "sparkler")
```

Then add `"/og/2/[file]"` to `outputFileTracingIncludes` in `next.config.ts`.

Storage paths, chunk rendering, `/api/prepare`, the send form, and the
fallback all work from the variant name; nothing else needs changing.

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
