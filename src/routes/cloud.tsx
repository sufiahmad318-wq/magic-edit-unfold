import { createFileRoute } from "@tanstack/react-router";
import { Cloud } from "@/pages/Cloud";

export const Route = createFileRoute("/cloud")({
  head: () => ({
    meta: [
      { title: "Cloud Backup — MagicEdit AI" },
      { name: "description", content: "Manage backups and sync settings for your MagicEdit AI projects." },
      { property: "og:title", content: "Cloud Backup — MagicEdit AI" },
      { property: "og:description", content: "Manage backups and sync for your MagicEdit AI projects." },
    ],
  }),
  component: Cloud,
});
