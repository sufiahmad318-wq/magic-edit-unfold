import { createFileRoute } from "@tanstack/react-router";
import { Tools } from "@/pages/Tools";
import { TOOLS } from "@/types";

export const Route = createFileRoute("/tools/$toolId")({
  head: ({ params }) => {
    const tool = TOOLS.find((t) => t.id === params.toolId);
    const title = tool ? `${tool.name} — MagicEdit AI` : "Tool Not Found — MagicEdit AI";
    const description = tool
      ? `${tool.description}. Runs on your device inside the MagicEdit AI editor.`
      : "This MagicEdit AI tool could not be found. Browse all AI editing tools instead.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Tools,
});
