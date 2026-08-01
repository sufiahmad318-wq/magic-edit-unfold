import { createFileRoute } from "@tanstack/react-router";
import { Export } from "@/pages/Export";

export const Route = createFileRoute("/editor/$projectId/export")({
  head: () => ({
    meta: [
      { title: "Export Project — MagicEdit AI" },
      { name: "description", content: "Export your edited photo as an image or PDF with MagicEdit AI." },
      { property: "og:title", content: "Export Project — MagicEdit AI" },
      { property: "og:description", content: "Export your edited photo as an image or PDF." },
    ],
  }),
  component: Export,
});
