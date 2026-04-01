"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PhraseItem, PhraseFunction } from "@/lib/types";
import { getAnnotations, addAnnotation, deleteAnnotation } from "@/lib/api";

const FUNCTION_COLORS: Record<PhraseFunction, { bg: string; text: string; border: string }> = {
  problem_setup:      { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  contribution_claim: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
  evaluation_framing: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  positioning:        { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  methodology:        { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200" },
  limitation:         { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
};

const FUNCTION_LABELS: Record<PhraseFunction, string> = {
  problem_setup:      "Problem setup",
  contribution_claim: "Contribution",
  evaluation_framing: "Evaluation",
  positioning:        "Positioning",
  methodology:        "Methodology",
  limitation:         "Limitation",
};

export default function PhraseCard({ phrase }: { phrase: PhraseItem }) {
  const [favorited, setFavorited] = useState(false);
  const [favoriteAnnotationId, setFavoriteAnnotationId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const colors = FUNCTION_COLORS[phrase.function as PhraseFunction] ?? {
    bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200",
  };

  // Check if already favorited on mount
  useEffect(() => {
    getAnnotations(phrase.item_id)
      .then((anns) => {
        const fav = anns.find(
          (a) =>
            a.tags.includes("phrase_favorite") &&
            a.note_text === phrase.text
        );
        if (fav) {
          setFavorited(true);
          setFavoriteAnnotationId(fav.id);
        }
      })
      .catch(console.error);
  }, [phrase.item_id, phrase.text]);

  async function handleFavorite() {
    setToggling(true);
    try {
      if (favorited && favoriteAnnotationId) {
        await deleteAnnotation(phrase.item_id, favoriteAnnotationId);
        setFavorited(false);
        setFavoriteAnnotationId(null);
      } else {
        const ann = await addAnnotation(phrase.item_id, {
          note_text: phrase.text,
          tags: ["phrase_favorite", phrase.function],
        });
        setFavorited(true);
        setFavoriteAnnotationId(ann.id);
      }
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border ${colors.border} ${colors.bg} p-4 transition hover:shadow-sm`}>
      {/* Header: category badge + favorite */}
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.text} border ${colors.border}`}
        >
          {FUNCTION_LABELS[phrase.function as PhraseFunction] ?? phrase.function}
        </span>
        <button
          onClick={handleFavorite}
          disabled={toggling}
          title={favorited ? "Remove from favorites" : "Save to favorites"}
          className={`text-lg leading-none transition ${
            favorited ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"
          } disabled:opacity-50`}
        >
          {favorited ? "★" : "☆"}
        </button>
      </div>

      {/* Phrase text */}
      <blockquote className={`border-l-2 ${colors.border} pl-3`}>
        <p className="text-sm text-gray-800 leading-relaxed italic">"{phrase.text}"</p>
      </blockquote>

      {/* Why effective */}
      {phrase.why_effective && (
        <p className="text-xs text-gray-500 leading-relaxed">{phrase.why_effective}</p>
      )}

      {/* Source */}
      <div className="flex items-center justify-between border-t border-current border-opacity-10 pt-2">
        <Link
          href={`/papers/${phrase.paper_id}`}
          className={`text-xs font-medium ${colors.text} hover:underline line-clamp-1 flex-1 mr-2`}
        >
          {phrase.paper_title || "Untitled"}
        </Link>
        {(phrase.venue || phrase.year) && (
          <span className="shrink-0 text-xs text-gray-400">
            {[phrase.venue, phrase.year].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}
