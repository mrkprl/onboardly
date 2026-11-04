import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Onboardly",
    short_name: "Onboardly",
    description: "Onboarding e offboarding con un agente AI: dispositivi, licenze e accessi sotto controllo.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#27272A",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
