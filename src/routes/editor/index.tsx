import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/pages/Editor";

export const Route = createFileRoute("/editor/")({
  head: () => ({
    meta: [
      { title: "Editor — MagicEdit AI" },
      { name: "description", content: "Open the MagicEdit AI editor and start a new photo project." },
      { property: "og:title", content: "Editor — MagicEdit AI" },
      { property: "og:description", content: "Start a new photo project in the MagicEdit AI editor." },
    ],
  }),
  component: Editor,
});
