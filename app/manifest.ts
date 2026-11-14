import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AeroDrop — Autonomous Flight Price Radar",
    short_name: "AeroDrop",
    description:
      "Real-time flight price drop tracker and automated multi-airline fare intelligence.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060913",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "My Radar Trackers",
        url: "/dashboard/trackers",
        description: "View all active monitored flight routes",
      },
      {
        name: "Flight Radar Search",
        url: "/dashboard",
        description: "Track new airline routes",
      },
      {
        name: "Price Notifications",
        url: "/dashboard/notifications",
        description: "View recent price drop notifications",
      },
    ],
  };
}
