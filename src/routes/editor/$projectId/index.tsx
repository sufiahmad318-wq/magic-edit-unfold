import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "@/pages/Editor";

export const Route = createFileRoute("/editor/$projectId/")({
  head: () => ({
    meta: [
      { title: "Edit Project — MagicEdit AI" },
      { name: "description", content: "Edit your photo project with MagicEdit AI tools and filters." },
      { property: "og:title", content: "Edit Project — MagicEdit AI" },
      { property: "og:description", content: "Edit your photo project with MagicEdit AI tools." },
    ],
  }),
  component: Editor,
});
