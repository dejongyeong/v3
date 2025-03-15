import type { MetadataRoute } from "next";

import { env } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${env.NEXT_PUBLIC_APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1, // 0.1 to 1.0 - how important is this page
    },
    // add more urls here if needed
  ];
}
