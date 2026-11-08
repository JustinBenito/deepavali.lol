// Every greeting type, its URL prefix (/<prefix>/<name>) and its copy.
// Safe to import from both server and browser code.
export const VARIANTS = ["diwali", "meme", "diya", "rangoli", "sparkler", "mithai", "dhamaka", "vanakkam"] as const;
export type Variant = (typeof VARIANTS)[number];

type Info = {
  prefix: string; // "" → deepavali.lol/justin, "2" → deepavali.lol/2/justin
  emoji: string; // after the title in link previews
  blurb: string; // link preview description; "{site}" is replaced with the domain
  ask: string; // heading over the "their name" form
  button: string;
};

export const VARIANT_INFO: Record<Variant, Info> = {
  diwali: {
    prefix: "",
    emoji: "🪔✨",
    blurb: "A little rocket, launched just for you. Send one to someone you love at {site}",
    ask: "Now send one to someone you love",
    button: "Light their rocket",
  },
  meme: { prefix: "1", emoji: "💥🔥", blurb: "Mass Diwali wishes, guns blazing. Send one to someone at {site}", ask: "Now send one to your gang", button: "Fire it to them" },
  diya: { prefix: "2", emoji: "🪔", blurb: "A diya lit just for you. Light one for someone at {site}", ask: "Light a diya for someone", button: "Light their diya" },
  rangoli: { prefix: "3", emoji: "🌸", blurb: "A rangoli, drawn just for you. Make one for someone at {site}", ask: "Draw one for someone you love", button: "Draw their rangoli" },
  sparkler: { prefix: "4", emoji: "✨", blurb: "Written in sparkler light, just for you. Write one at {site}", ask: "Write one for someone", button: "Write their name" },
  mithai: { prefix: "5", emoji: "🍬", blurb: "A box of Diwali sweets, just for you. Send some at {site}", ask: "Send sweets to someone", button: "Send their mithai" },
  dhamaka: { prefix: "6", emoji: "💥", blurb: "Full dhamaka Diwali wishes. Send one at {site}", ask: "Send a dhamaka to someone", button: "Light the ladi" },
  vanakkam: { prefix: "7", emoji: "🙏💣", blurb: "Vanakkam! Diwali wishes with folded hands and two bombs. Send one at {site}", ask: "Send a vanakkam to someone", button: "Light their bomb" },
};

export const PREFIX = Object.fromEntries(VARIANTS.map((v) => [v, VARIANT_INFO[v].prefix])) as Record<Variant, string>;

/** "/2" for /2/<name> types, "" for the default greeting. */
export const pathPrefix = (v: Variant) => (PREFIX[v] ? `/${PREFIX[v]}` : "");

export const variantForPrefix = (p: string): Variant | undefined => VARIANTS.find((v) => PREFIX[v] && PREFIX[v] === p);
