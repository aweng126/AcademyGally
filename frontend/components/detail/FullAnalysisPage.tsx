"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Paper, ModuleType } from "@/lib/types";
import { getFullAnalysis } from "@/lib/api";
import ModuleAnalysisPanel from "./ModuleAnalysisPanel";
import StatusBadge from "@/components/shared/StatusBadge";
import AddToTopicButton from "@/components/shared/AddToTopicButton";

const MODULE_ORDER: ModuleType[] = ["abstract", "arch_figure", "eval_figure", "algorithm"];

export default function FullAnalysisPage({ paperId }: { paperId: string }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getFullAnalysis(paperId)
      .then(setPaper)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [paperId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any item is still processing
  useEffect(() => {
    if (!paper) return;
    const hasProcessing = paper.content_items?.some(
      (i) => i.processing_status === "pending" || i.processing_status === "processing"
    );
    if (!hasProcessing) return;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [paper, load]);

  if (loading && !paper) {
    return <p className="p-6 text-sm text-gray-400">Loading...</p>;
  }
  if (!paper) {
    return <p className="p-6 text-sm text-red-500">Paper not found.</p>;
  }

  const items = paper.content_items ?? [];
  const hasUnclassified = items.some((i) => i.module_type === "other");

  const sortedItems = [...items]
    .filter((i) => i.module_type !== "other")
    .sort(
      (a, b) =>
        MODULE_ORDER.indexOf(a.module_type as ModuleType) -
        MODULE_ORDER.indexOf(b.module_type as ModuleType)
    );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      {/* Paper header */}
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
          ← Library
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold leading-snug">{paper.title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <AddToTopicButton paperId={paper.id} />
            <StatusBadge status={paper.processing_status} />
          </div>
        </div>
        {(paper.authors || paper.venue || paper.year) && (
          <p className="text-sm text-gray-500">
            {[paper.authors, paper.venue, paper.year].filter(Boolean).join(" · ")}
          </p>
        )}
        {hasUnclassified && (
          <div className="mt-1 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            Some figures haven't been classified yet.{" "}
            <Link href={`/papers/${paper.id}/confirm`} className="font-medium underline">
              Classify figures →
            </Link>
          </div>
        )}
      </header>

      {/* Module panels */}
      {sortedItems.length > 0 ? (
        sortedItems.map((item) => (
          <ModuleAnalysisPanel key={item.id} item={item} />
        ))
      ) : (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          {hasUnclassified
            ? "Classify figures above to start analysis."
            : "No analysis available yet."}
        </div>
      )}
    </div>
  );
}
