import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/pages/Workspace";

export const Route = createFileRoute("/workspace/$projectId")({
  head: () => ({
    meta: [
      { title: "Editing — AI Photo Workspace | MagicEdit AI" },
      { name: "description", content: "Edit this project on the pro AI canvas: enhance, cut out backgrounds, erase objects, crop, filter, add text and stickers." },
      { property: "og:title", content: "AI Photo Workspace — MagicEdit AI" },
      { property: "og:description", content: "Edit this project on the pro AI photo canvas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});
