import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aventis Leads",
    short_name: "Aventis",
    description: "Autonomous lead discovery for Aventis Marketing & AventisAI",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#5168fa",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      // Explicit sizes satisfy Chrome's installability requirement (192+ required)
      {
        src: "/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
