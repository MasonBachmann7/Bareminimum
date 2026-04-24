import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bareminimum — your contribution graph, on autopilot",
  description:
    "Connect your GitHub. The bot commits for you so your graph fills in. Tell it what you want to build and it contributes 100 lines a day toward that idea. You touch grass.",
  openGraph: {
    title: "bareminimum — your contribution graph, on autopilot",
    description:
      "The bot greens your graph and builds your side project at the same time. You touch grass.",
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='3' fill='%2326a641'/></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
