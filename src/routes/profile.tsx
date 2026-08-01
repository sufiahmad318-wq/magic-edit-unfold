import { createFileRoute } from "@tanstack/react-router";
import { Profile } from "@/pages/Profile";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — MagicEdit AI" },
      { name: "description", content: "View your MagicEdit AI usage stats, storage and app settings." },
      { property: "og:title", content: "Profile & Settings — MagicEdit AI" },
      { property: "og:description", content: "View your MagicEdit AI stats, storage and settings." },
    ],
  }),
  component: Profile,
});
