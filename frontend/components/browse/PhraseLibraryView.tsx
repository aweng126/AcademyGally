"use client";

import { useEffect, useState } from "react";
import type { PhraseItem, PhraseFunction } from "@/lib/types";
import { getPhrases } from "@/lib/api";
import PhraseCard from "./PhraseCard";

const FUNCTION_FILTERS: { value: PhraseFunction | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "problem_setup", label: "Problem setup" },
  { value: "contribution_claim", label: "Contribution" },
  { value: "evaluation_framing", label: "Evaluation" },
  { value: "positioning", label: "Positioning" },
  { value: "methodology", label: "Methodology" },
  { value: "limitation", label: "Limitation" },
];

export default function PhraseLibraryView() {
  const [phrases, setPhrases] = useState<PhraseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFunction, setActiveFunction] = useState<PhraseFunction | "all">("all");
  const [venueFilter, setVenueFilter] = useState("");
  const [venueInput, setVenueInput] = useState("");

  useEffect(() => {
    setLoading(true);
    const params: { function?: string; venue?: string } = {};
    if (activeFunction !== "all") params.function = activeFunction;
    if (venueFilter) params.venue = venueFilter;
    getPhrases(Object.keys(params).length ? params : undefined)
      .then(setPhrases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeFunction, venueFilter]);

  return (
    <div className="flex flex-col gap-5">
      {/* Function filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {FUNCTION_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveFunction(value as PhraseFunction | "all")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              activeFunction === value
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}

        {/* Venue filter inline */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by venue…"
            value={venueInput}
            onChange={(e) => setVenueInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setVenueFilter(venueInput)}
            className="rounded border border-gray-300 px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 w-40"
          />
          {venueFilter && (
            <button
              onClick={() => { setVenueFilter(""); setVenueInput(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">
        {loading ? "Loading…" : `${phrases.length} phrase${phrases.length !== 1 ? "s" : ""}`}
      </p>

      {/* Empty state */}
      {!loading && phrases.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm font-medium text-gray-500">No phrases yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Phrases are extracted when abstracts are analyzed.
            {activeFunction !== "all" && " Try selecting a different category."}
          </p>
        </div>
      )}

      {/* Phrase grid */}
      {!loading && phrases.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {phrases.map((phrase, i) => (
            <PhraseCard key={`${phrase.item_id}-${i}`} phrase={phrase} />
          ))}
        </div>
      )}
    </div>
  );
}
