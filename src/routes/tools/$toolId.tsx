import { createFileRoute } from "@tanstack/react-router";
import { Tools } from "@/pages/Tools";

export const Route = createFileRoute("/tools/$toolId")({
  head: () => ({
    meta: [
      { title: "Tool — MagicEdit AI" },
      { name: "description", content: "Use this MagicEdit AI tool to edit your photo instantly." },
      { property: "og:title", content: "Tool — MagicEdit AI" },
      { property: "og:description", content: "Use this MagicEdit AI tool to edit your photo." },
    ],
  }),
  component: Tools,
});
