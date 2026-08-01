import { createFileRoute } from "@tanstack/react-router";
import { Assets } from "@/pages/Assets";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Assets Library — MagicEdit AI" },
      { name: "description", content: "Browse stickers, overlays and graphics in your MagicEdit AI asset library." },
      { property: "og:title", content: "Assets Library — MagicEdit AI" },
      { property: "og:description", content: "Browse stickers, overlays and graphics for your edits." },
    ],
  }),
  component: Assets,
});
