"use client";

import { useState } from "react";
import Link from "next/link";
import type { Paper } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleChip from "./ModuleChip";
import AddToTopicButton from "@/components/shared/AddToTopicButton";
import { deletePaper } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function PaperCard({
  paper,
  onDelete,
}: {
  paper: Paper;
  onDelete?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const items = paper.content_items ?? [];
  const archFigure = items.find((i) => i.module_type === "arch_figure" && i.image_path);
  const hasUnclassified =
    paper.processing_status === "done" && items.some((i) => i.module_type === "other");

  async function handleDelete() {
    if (!confirm(`Delete "${paper.title || "this paper"}"?\n\nThis will permanently remove the paper, all extracted figures, and annotations.`)) return;
    setDeleting(true);
    try {
      await deletePaper(paper.id);
      onDelete?.(paper.id);
    } catch {
      alert("Failed to delete paper. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="relative flex gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete paper"
        className="absolute right-3 top-3 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
      >
        {deleting ? (
          <span className="h-4 w-4 block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Arch figure thumbnail */}
      {archFigure?.image_path ? (
        <img
          src={`${API_URL}/figures/${archFigure.image_path}`}
          alt="arch figure thumbnail"
          className="h-20 w-28 shrink-0 rounded object-cover bg-gray-50"
        />
      ) : (
        <div className="h-20 w-28 shrink-0 rounded bg-gray-100" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
        <Link
          href={`/papers/${paper.id}`}
          className="truncate font-medium hover:underline"
        >
          {paper.title}
        </Link>
        <p className="text-sm text-gray-500">
          {[paper.authors, paper.venue, paper.year].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={paper.processing_status} />
          {(["arch_figure", "abstract", "eval_figure"] as const).map((mt) => {
            const item = items.find((i) => i.module_type === mt);
            return item ? (
              <ModuleChip key={mt} moduleType={mt} status={item.processing_status} />
            ) : null;
          })}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          {hasUnclassified && (
            <Link
              href={`/papers/${paper.id}/confirm`}
              className="text-xs text-blue-600 hover:underline"
            >
              Classify figures →
            </Link>
          )}
          {paper.processing_status === "done" && (
            <AddToTopicButton paperId={paper.id} compact />
          )}
        </div>
      </div>
    </div>
  );
}
