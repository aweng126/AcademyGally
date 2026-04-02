"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ContentItem } from "@/lib/types";
import { getPaper, confirmItems } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TYPE_OPTIONS = [
  { value: "arch_figure", label: "Architecture Figure" },
  { value: "eval_figure", label: "Evaluation Figure" },
  { value: "other", label: "Skip" },
];

/**
 * Suggest a module type from the caption text using keyword matching.
 *
 * Signal priority (highest to lowest):
 * 1. Caption contains explicit type keywords  (most reliable)
 * 2. Caption contains section-context words   (design / eval section hints)
 * 3. Figure number heuristic: Figure 1 is almost always the overview/arch figure
 *
 * Returns one of: "arch_figure" | "eval_figure" | "algorithm" | "other"
 */
function suggestModuleType(caption: string): string {
  const t = (caption ?? "").toLowerCase();

  // ── Architecture / system design signals ───────────────────────────────
  if (
    /architect|overview|system\s+design|high.?level\s+design|framework|topology|pipeline\s+overview|workflow|component\s+diagram|block\s+diagram/.test(t)
  ) return "arch_figure";

  // ── Evaluation / results signals ───────────────────────────────────────
  if (
    /evaluat|result|performance|latency|throughput|comparison|speedup|overhead|benchmark|cdf|percentile|p99|p95|scalab|micro.?bench|experiment|median|tail/.test(t)
  ) return "eval_figure";

  // ── Algorithm signals ──────────────────────────────────────────────────
  if (/algorithm|pseudo.?code|listing|procedure|pseudocode/.test(t))
    return "algorithm";

  // ── Weaker design signals (second pass) ───────────────────────────────
  if (/design|structure|layout|layer|component|module\s+structure|abstraction/.test(t))
    return "arch_figure";

  // ── Weaker eval signals (second pass) ─────────────────────────────────
  if (/improve|reduce|cost|resource|utilization|rate|time|memory|cpu|io\s+/.test(t))
    return "eval_figure";

  // ── Figure-number heuristic: Figure 1 is almost always the arch overview ─
  const numMatch = caption.match(/(?:Figure|Fig\.?)\s*(\d+)/i);
  if (numMatch && parseInt(numMatch[1], 10) === 1) return "arch_figure";

  return "other";
}

export default function ConfirmPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  // Track which item IDs were auto-suggested (not manually set by the user)
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [paperTitle, setPaperTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const paper = await getPaper(params.id);
        if (cancelled) return;

        setPaperTitle(paper.title);
        const status = paper.processing_status;
        const all = paper.content_items ?? [];

        // Still extracting — keep polling
        if ((status === "pending" || status === "processing") && all.length === 0) {
          setExtracting(true);
          pollRef.current = setTimeout(poll, 2000);
          return;
        }

        setExtracting(false);
        setItems(all);
        const init: Record<string, string> = {};
        const autoSuggested = new Set<string>();
        all.forEach((item) => {
          if (item.module_type !== "other") {
            // Already classified (e.g. abstract added by backend)
            init[item.id] = item.module_type;
          } else {
            const suggestion = suggestModuleType(item.caption ?? "");
            init[item.id] = suggestion;
            if (suggestion !== "other") autoSuggested.add(item.id);
          }
        });
        setSelections(init);
        setSuggested(autoSuggested);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [params.id]);

  const handleSelectAll = (type: string) => {
    const next: Record<string, string> = {};
    items.forEach((item) => (next[item.id] = type));
    setSelections(next);
    setSuggested(new Set()); // manual override clears all suggestion badges
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const confirmations = items.map((item) => ({
        item_id: item.id,
        module_type: selections[item.id] ?? "other",
      }));
      await confirmItems(params.id, confirmations);
      router.push(`/papers/${params.id}`);
    } catch (e) {
      console.error(e);
      setSubmitError(e instanceof Error ? e.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  const toAnalyze = items.filter((i) => (selections[i.id] ?? "other") !== "other").length;

  if (loading || extracting) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p>{extracting ? "Extracting figures from PDF…" : "Loading figures…"}</p>
        {extracting && (
          <p className="text-xs text-gray-400">This usually takes 5–20 seconds</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/papers/${params.id}`}
          className="mb-3 block text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back to paper
        </Link>
        <h1 className="text-xl font-bold">Classify Figures</h1>
        <p className="mt-1 text-sm text-gray-500">{paperTitle}</p>
        <p className="mt-0.5 text-sm text-gray-400">
          {items.length} figure{items.length !== 1 ? "s" : ""} extracted.
          Mark each image type — classified figures will be analyzed by AI.
        </p>
      </div>

      {/* Bulk actions */}
      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Select all as:</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelectAll(opt.value)}
              className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Figure grid */}
      {items.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-400">
          No figures were extracted from this PDF.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => {
            const selected = selections[item.id] ?? "other";
            const isSuggested = suggested.has(item.id);
            const borderColor =
              selected === "arch_figure"
                ? "border-blue-400 ring-1 ring-blue-300"
                : selected === "eval_figure"
                ? "border-green-400 ring-1 ring-green-300"
                : "border-gray-200";

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 rounded-lg border bg-white p-2 transition ${borderColor}`}
              >
                {item.image_path ? (
                  <img
                    src={`${API_URL}/figures/${item.image_path}`}
                    alt={item.caption ?? "figure"}
                    className="aspect-video w-full rounded object-contain bg-gray-50"
                  />
                ) : (
                  <div className="aspect-video w-full rounded bg-gray-100" />
                )}

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">Page {item.page_number}</p>
                  {isSuggested && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 border border-amber-200">
                      auto
                    </span>
                  )}
                </div>

                {item.caption && (
                  <p className="line-clamp-2 text-[11px] leading-tight text-gray-600">
                    {item.caption}
                  </p>
                )}
                <select
                  value={selected}
                  onChange={(e) => {
                    setSelections((prev) => ({ ...prev, [item.id]: e.target.value }));
                    // Clear suggestion badge once user manually changes the value
                    setSuggested((prev) => {
                      const next = new Set(prev);
                      next.delete(item.id);
                      return next;
                    });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {submitError && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {submitError}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <p className="text-sm text-gray-500">
          {toAnalyze > 0 ? (
            <span>
              <strong>{toAnalyze}</strong> figure{toAnalyze !== 1 ? "s" : ""} will be sent to AI
              analysis.
            </span>
          ) : (
            "No figures selected for analysis."
          )}
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Confirm & Analyze"}
        </button>
      </div>
    </div>
  );
}
