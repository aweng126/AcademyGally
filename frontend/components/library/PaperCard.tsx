"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Paper, ArchFigureAnalysis, AbstractAnalysis, EvalFigureAnalysis, AlgorithmAnalysis } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleChip from "./ModuleChip";
import AddToTopicButton from "@/components/shared/AddToTopicButton";
import { deletePaper, reprocessPaper } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const MODULE_SECTION: Record<string, { label: string; color: string }> = {
  abstract:    { label: "Abstract",       color: "bg-blue-50 border-blue-100 text-blue-700" },
  arch_figure: { label: "Design",         color: "bg-purple-50 border-purple-100 text-purple-700" },
  eval_figure: { label: "Evaluation",     color: "bg-amber-50 border-amber-100 text-amber-700" },
  algorithm:   { label: "Algorithm",      color: "bg-green-50 border-green-100 text-green-700" },
};

const MODULE_ORDER = ["abstract", "arch_figure", "eval_figure", "algorithm"];

export default function PaperCard({
  paper,
  onDelete,
  onRetry,
}: {
  paper: Paper;
  onDelete?: (id: string) => void;
  onRetry?: (updated: Paper) => void;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [paperTopics, setPaperTopics] = useState<{ id: string; name: string }[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [modulesExpanded, setModulesExpanded] = useState(false);

  const items = paper.content_items ?? [];
  const archFigure = items.find((i) => i.module_type === "arch_figure" && i.image_path);
  const hasUnclassified =
    paper.processing_status === "done" && items.some((i) => i.module_type === "other");

  const analyzedItems = items
    .filter((i) => i.processing_status === "done" && i.module_type !== "other")
    .sort((a, b) => MODULE_ORDER.indexOf(a.module_type) - MODULE_ORDER.indexOf(b.module_type));

  async function handleRetry() {
    setRetrying(true);
    try {
      const updated = await reprocessPaper(paper.id);
      onRetry?.(updated);
    } catch {
      // silently ignore; status will remain failed
    } finally {
      setRetrying(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePaper(paper.id);
      onDelete?.(paper.id);
    } catch {
      setDeleteError("删除失败，请稍后重试");
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm transition hover:shadow-md">
      <div className="relative flex gap-4 p-4">
        {/* Delete button */}
        <button
          onClick={() => { setConfirmOpen(true); setDeleteError(null); }}
          title="删除论文"
          className="absolute right-3 top-3 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Arch figure thumbnail */}
        {archFigure?.image_path ? (
          <img
            src={`${API_URL}/figures/${archFigure.image_path}`}
            alt="arch figure"
            className="h-20 w-28 shrink-0 rounded object-cover bg-gray-50"
          />
        ) : (
          <div className="h-20 w-28 shrink-0 rounded bg-gray-100" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
          <Link href={`/papers/${paper.id}`} className="truncate font-medium hover:underline">
            {paper.title || <span className="text-gray-400 italic">Untitled</span>}
          </Link>
          <p className="text-sm text-gray-500">
            {[paper.authors, paper.venue, paper.year].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={paper.processing_status} />
            {paper.processing_status === "failed" && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 hover:bg-orange-100 disabled:opacity-50"
              >
                {retrying ? "Retrying…" : "Retry"}
              </button>
            )}
            {(["arch_figure", "abstract", "eval_figure"] as const).map((mt) => {
              const item = items.find((i) => i.module_type === mt);
              return item ? <ModuleChip key={mt} moduleType={mt} status={item.processing_status} /> : null;
            })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {hasUnclassified && (
              <Link href={`/papers/${paper.id}/confirm`} className="text-xs text-blue-600 hover:underline">
                Classify figures →
              </Link>
            )}
            {paper.processing_status === "done" && (
              <AddToTopicButton
                paperId={paper.id}
                compact
                onTopicsChange={setPaperTopics}
              />
            )}
            {paperTopics.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/topics/${t.id}`)}
                className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 hover:border-gray-400 hover:bg-white transition"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Module expand toggle */}
      {analyzedItems.length > 0 && (
        <button
          onClick={() => setModulesExpanded((v) => !v)}
          className="flex w-full items-center gap-2 border-t px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition"
        >
          <span className={`transition-transform duration-150 ${modulesExpanded ? "rotate-90" : ""}`}>▶</span>
          <span>{modulesExpanded ? "Hide" : "Show"} modules</span>
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
            {analyzedItems.length}
          </span>
        </button>
      )}

      {/* Module content preview */}
      {modulesExpanded && analyzedItems.length > 0 && (
        <div className="border-t bg-gray-50 px-4 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {analyzedItems.map((item) => {
              const sec = MODULE_SECTION[item.module_type];
              const a = item.analysis_json;

              let preview: React.ReactNode = null;

              if (item.module_type === "abstract" && a) {
                const abs = a as AbstractAnalysis;
                preview = (
                  <p className="line-clamp-2 text-xs text-gray-600">
                    {abs.problem_statement || abs.proposed_approach || ""}
                  </p>
                );
              } else if (item.module_type === "arch_figure") {
                const arch = a as ArchFigureAnalysis | null;
                preview = (
                  <div className="flex gap-2">
                    {item.image_path && (
                      <img
                        src={`${API_URL}/figures/${item.image_path}`}
                        alt="arch"
                        className="h-12 w-16 shrink-0 rounded object-contain bg-white border"
                      />
                    )}
                    {arch?.core_problem && (
                      <p className="line-clamp-3 text-xs text-gray-600">{arch.core_problem}</p>
                    )}
                  </div>
                );
              } else if (item.module_type === "eval_figure" && a) {
                const ev = a as EvalFigureAnalysis;
                preview = (
                  <p className="line-clamp-2 text-xs text-gray-600">{ev.headline_result}</p>
                );
              } else if (item.module_type === "algorithm" && a) {
                const alg = a as AlgorithmAnalysis;
                preview = (
                  <p className="line-clamp-2 text-xs text-gray-600">
                    <span className="font-medium">{alg.algorithm_name}</span>
                    {alg.purpose ? ` — ${alg.purpose}` : ""}
                  </p>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={`/papers/${paper.id}`}
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 transition hover:shadow-sm ${sec?.color ?? "bg-gray-50 border-gray-100"}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {sec?.label ?? item.module_type}
                  </span>
                  {preview ?? <p className="text-xs text-gray-400 italic">Analysis complete</p>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline error */}
      {deleteError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">
          {deleteError}
        </div>
      )}

      {/* Inline confirm bar */}
      {confirmOpen && (
        <div className="flex items-center justify-between border-t bg-red-50 px-4 py-3">
          <p className="text-sm text-gray-700">
            确认删除该论文及其所有图片、分析和标注？此操作不可撤销。
          </p>
          <div className="ml-4 flex shrink-0 gap-2">
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded bg-red-500 px-3 py-1 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? "删除中…" : "确认删除"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
