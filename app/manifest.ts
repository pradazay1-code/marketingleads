import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aventis Leads",
    short_name: "Aventis",
    description: "Autonomous lead discovery for Aventis Marketing & AventisAI",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#5168fa",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
