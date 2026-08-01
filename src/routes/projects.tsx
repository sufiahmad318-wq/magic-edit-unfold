import { createFileRoute } from "@tanstack/react-router";
import { Projects } from "@/pages/Projects";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "My Projects — MagicEdit AI" },
      { name: "description", content: "All of your saved MagicEdit AI photo projects in one place." },
      { property: "og:title", content: "My Projects — MagicEdit AI" },
      { property: "og:description", content: "All of your saved MagicEdit AI photo projects." },
    ],
  }),
  component: Projects,
});
