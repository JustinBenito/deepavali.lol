import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="credit">
          Built with bright light, a try by{" "}
          <a href="https://limegreen.studio" target="_blank" rel="noopener">
            LGS <span>(limegreen.studio)</span>
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
