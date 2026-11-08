// Every greeting type, and the URL prefix it lives under: /<prefix>/<name>.
// Safe to import from both server and browser code.
export const VARIANTS = ["diwali", "meme"] as const;
export type Variant = (typeof VARIANTS)[number];

export const PREFIX: Record<Variant, string> = {
  diwali: "", // deepavali.lol/justin
  meme: "1", // deepavali.lol/1/justin
};

// "/1" for the meme, "" for the default greeting.
export const pathPrefix = (v: Variant) => (PREFIX[v] ? `/${PREFIX[v]}` : "");
