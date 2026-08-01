import { createFileRoute } from "@tanstack/react-router";
import { Templates } from "@/pages/Templates";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — MagicEdit AI" },
      { name: "description", content: "Start from a ready-made MagicEdit AI template for social posts, thumbnails and more." },
      { property: "og:title", content: "Templates — MagicEdit AI" },
      { property: "og:description", content: "Start from a ready-made MagicEdit AI design template." },
    ],
  }),
  component: Templates,
});
