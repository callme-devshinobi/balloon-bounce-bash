import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Balloon Rescue — Save the stick figure!" },
      {
        name: "description",
        content:
          "Balloon Rescue is a cheerful hangman-style word game. Guess the word before the balloons pop and the stick figure falls into the alligator lake!",
      },
      { property: "og:title", content: "Balloon Rescue" },
      {
        property: "og:description",
        content:
          "Guess the word before all 15 balloons pop! A cartoon browser game inspired by Hangman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    // Ensure full-viewport iframe with no scroll
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
  }, []);
  return (
    <iframe
      src="/balloon-rescue/index.html"
      title="Balloon Rescue"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "0",
        display: "block",
      }}
      allow="autoplay; fullscreen"
    />
  );
}
