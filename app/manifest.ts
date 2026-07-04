import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FoodPlanner",
    short_name: "FoodPlanner",
    description: "Personal meal planner for Rob & Steph",
    start_url: "/foodapp",
    display: "standalone",
    background_color: "#15803d",
    theme_color: "#15803d",
    icons: [
      {
        src: "/foodapp/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  }
}
