"use client";

import { useState } from "react";
import Link from "next/link";
import type { TopicPaper, ContentItem, ModuleType } from "@/lib/types";
import { getContent, updatePaperProgress } from "@/lib/api";
import ProgressBar from "@/components/shared/ProgressBar";
import ModuleAnalysisPanel from "@/components/detail/ModuleAnalysisPanel";
import { type StudyFocus, SECTION_MODULE_MAP, SECTION_LABELS } from "./StudyFocusSelector";

const MODULE_ORDER: ModuleType[] = ["abstract", "arch_figure", "eval_figure", "algorithm"];

const MODULE_LABEL: Record<string, string> = {
  abstract:    "Abstract",
  arch_figure: "Design",
  eval_figure: "Evaluation",
  algorithm:   "Implementation",
};

interface Props {
  tp: TopicPaper;
  topicId: string;
  visibleModules: ModuleType[];
  currentFocus: StudyFocus;
  onProgressUpdate: (paperId: string, progress: Record<string, boolean>) => void;
  onRemove: (paperId: string) => void;
  onMoveUp: (paperId: string) => void;
  onMoveDown: (paperId: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function SeriesPaperRow({
  tp,
  topicId,
  visibleModules,
  currentFocus,
  onProgressUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: Props) {
  // Is this section locked (no module_type mapped yet)?
  const isSectionLocked = currentFocus !== "all" && SECTION_MODULE_MAP[currentFocus] === null;
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const allModuleEntries = Object.entries(tp.progress_json) as [string, boolean][];
  const doneCount = allModuleEntries.filter(([, v]) => v).length;
  const pct = allModuleEntries.length ? (doneCount / allModuleEntries.length) * 100 : 0;

  const handleExpand = async () => {
    if (!expanded && items.length === 0) {
      setLoadingItems(true);
      try {
        const fetched = await getContent({ paper_id: tp.paper_id });
        setItems(fetched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingItems(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleToggle = async (module: string, done: boolean) => {
    const updated = { ...tp.progress_json, [module]: done };
    setToggleError(null);
    try {
      await updatePaperProgress(topicId, tp.paper_id, updated);
      onProgressUpdate(tp.paper_id, updated);
    } catch (e) {
      console.error(e);
      setToggleError("Failed to save progress. Please try again.");
    }
  };

  // Items to show in the series, ordered and filtered by focus
  const seriesItems = [...items]
    .filter(
      (i) =>
        visibleModules.includes(i.module_type as ModuleType) &&
        i.processing_status === "done"
    )
    .sort(
      (a, b) =>
        MODULE_ORDER.indexOf(a.module_type as ModuleType) -
        MODULE_ORDER.indexOf(b.module_type as ModuleType)
    );

  return (
    <div>
      {/* Collapsed header */}
      <div
        className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-gray-50 select-none"
        onClick={handleExpand}
      >
        <span
          className={`text-gray-400 transition-transform duration-150 text-[10px] ${
            expanded ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>

        <div className="flex-1 min-w-0">
          <Link
            href={`/papers/${tp.paper_id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-medium text-gray-800 hover:underline"
          >
            {tp.paper?.title ?? tp.paper_id}
          </Link>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar value={pct} />
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {doneCount}/{allModuleEntries.length} modules
            </span>
          </div>
        </div>

        {/* Reorder and remove controls */}
        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            disabled={isFirst}
            onClick={() => onMoveUp(tp.paper_id)}
            className="rounded p-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
            title="Move up"
          >
            ▲
          </button>
          <button
            disabled={isLast}
            onClick={() => onMoveDown(tp.paper_id)}
            className="rounded p-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:cursor-not-allowed"
            title="Move down"
          >
            ▼
          </button>
          <button
            onClick={() => onRemove(tp.paper_id)}
            className="ml-1 rounded p-1 text-xs text-gray-400 hover:text-red-500"
            title="Remove from topic"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Expanded series content */}
      {expanded && (
        <div className="border-t bg-gray-50 px-5 pb-6 pt-4">
          {toggleError && (
            <p className="mb-3 text-xs text-red-500">{toggleError}</p>
          )}
          {loadingItems ? (
            <p className="text-sm text-gray-400">Loading content...</p>
          ) : isSectionLocked ? (
            <div className="rounded-md border border-dashed border-gray-200 bg-white p-6 text-center">
              <p className="text-2xl mb-2">🔒</p>
              <p className="text-sm font-medium text-gray-500">
                {SECTION_LABELS[currentFocus]} not yet extracted
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Automatic extraction of this section is planned for Phase 2.
              </p>
            </div>
          ) : seriesItems.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              No analyzed content yet for this section.
              {items.length === 0 && (
                <span>
                  {" "}
                  <Link
                    href={`/papers/${tp.paper_id}/confirm`}
                    className="text-blue-600 hover:underline"
                  >
                    Classify figures →
                  </Link>
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {seriesItems.map((item, idx) => (
                <div key={item.id} className="flex flex-col gap-3">
                  {/* Module header with progress toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {MODULE_LABEL[item.module_type] ?? item.module_type.replace("_", " ")}
                      </span>
                    </div>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                      <input
                        type="checkbox"
                        checked={tp.progress_json[item.module_type] ?? false}
                        onChange={(e) => handleToggle(item.module_type, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 rounded accent-gray-800"
                      />
                      Mark as read
                    </label>
                  </div>

                  {/* Content panel */}
                  <ModuleAnalysisPanel item={item} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
