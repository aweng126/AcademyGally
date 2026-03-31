"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/lib/types";
import { getPaper, confirmItems } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TYPE_OPTIONS = [
  { value: "arch_figure", label: "Architecture Figure" },
  { value: "eval_figure", label: "Evaluation Figure" },
  { value: "other", label: "Skip" },
];

export default function ConfirmPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [paperTitle, setPaperTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getPaper(params.id)
      .then((paper) => {
        setPaperTitle(paper.title);
        const all = paper.content_items ?? [];
        setItems(all);
        const init: Record<string, string> = {};
        all.forEach((item) => {
          init[item.id] = item.module_type === "other" ? "other" : item.module_type;
        });
        setSelections(init);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSelectAll = (type: string) => {
    const next: Record<string, string> = {};
    items.forEach((item) => (next[item.id] = type));
    setSelections(next);
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        Loading figures...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-3 text-sm text-gray-500 hover:text-gray-800"
        >
          ← Back
        </button>
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
                <p className="text-[11px] text-gray-400">Page {item.page_number}</p>
                {item.caption && (
                  <p className="line-clamp-2 text-[11px] leading-tight text-gray-600">
                    {item.caption}
                  </p>
                )}
                <select
                  value={selected}
                  onChange={(e) =>
                    setSelections((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
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
