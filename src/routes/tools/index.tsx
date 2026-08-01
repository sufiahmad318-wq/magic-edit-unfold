import { createFileRoute } from "@tanstack/react-router";
import { Tools } from "@/pages/Tools";

export const Route = createFileRoute("/tools/")({
  head: () => ({
    meta: [
      { title: "AI Editing Tools — MagicEdit AI" },
      {
        name: "description",
        content:
          "Browse every MagicEdit AI tool: enhance, background removal, retouch, filters, crop and more.",
      },
      { property: "og:title", content: "AI Editing Tools — MagicEdit AI" },
      { property: "og:description", content: "Browse every MagicEdit AI editing tool." },
    ],
  }),
  component: Tools,
});
