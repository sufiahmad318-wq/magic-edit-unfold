import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/pages/Workspace";

export const Route = createFileRoute("/workspace/")({
  head: () => ({
    meta: [
      { title: "AI Photo Workspace — MagicEdit AI" },
      { name: "description", content: "Pro AI photo editing workspace: enhance, background removal, magic eraser, crop, filters, text and stickers." },
      { property: "og:title", content: "AI Photo Workspace — MagicEdit AI" },
      { property: "og:description", content: "Edit photos with AI tools on a full pro canvas workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});
