import { createFileRoute } from "@tanstack/react-router";
import { Home } from "@/pages/Home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MagicEdit AI — AI Photo Editing Studio" },
      {
        name: "description",
        content:
          "MagicEdit AI is a mobile-first photo studio: enhance, retouch and export images with AI-powered tools, templates and cloud backup.",
      },
      { property: "og:title", content: "MagicEdit AI — AI Photo Editing Studio" },
      {
        property: "og:description",
        content: "Enhance, retouch and export images with AI-powered editing tools.",
      },
    ],
  }),
  component: Home,
});
