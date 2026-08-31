import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wins Draft Auction",
    short_name: "Wins Draft",
    description: "Live standings for the NFL wins draft auction pool",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e14",
    theme_color: "#0a0e14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
