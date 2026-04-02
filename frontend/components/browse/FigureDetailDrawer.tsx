"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContentItem, ArchFigureAnalysis, AbstractAnalysis, EvalFigureAnalysis, AlgorithmAnalysis, UserAnnotation } from "@/lib/types";
import { getAnnotations, addAnnotation, deleteAnnotation } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function AnalysisSummary({ item }: { item: ContentItem }) {
  const a = item.analysis_json;
  if (!a) return <p className="text-sm text-gray-400">No analysis yet.</p>;

  if (item.module_type === "arch_figure") {
    const arch = a as ArchFigureAnalysis;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {arch.core_problem && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">Core problem</p>
            <p className="text-gray-700">{arch.core_problem}</p>
          </div>
        )}
        {arch.design_insight && (
          <div className="rounded-lg bg-purple-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-500">Design insight</p>
            <p className="text-gray-700">{arch.design_insight}</p>
          </div>
        )}
        {arch.components?.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Components</p>
            <div className="flex flex-wrap gap-1.5">
              {arch.components.slice(0, 6).map((c, i) => (
                <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{c.name}</span>
              ))}
            </div>
          </div>
        )}
        {arch.related_systems?.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Related systems</p>
            <div className="flex flex-wrap gap-1.5">
              {arch.related_systems.map((s, i) => (
                <span key={i} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (item.module_type === "abstract") {
    const abs = a as AbstractAnalysis;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {abs.problem_statement && (
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">Problem</p>
            <p className="text-gray-700">{abs.problem_statement}</p>
          </div>
        )}
        {abs.proposed_approach && (
          <div className="rounded-lg bg-green-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-500">Approach</p>
            <p className="text-gray-700">{abs.proposed_approach}</p>
          </div>
        )}
        {abs.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {abs.keywords.map((k, i) => (
              <span key={i} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700">{k}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.module_type === "eval_figure") {
    const ev = a as EvalFigureAnalysis;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {ev.headline_result && (
          <div className="rounded-lg bg-green-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-500">Key result</p>
            <p className="text-gray-700">{ev.headline_result}</p>
          </div>
        )}
        {ev.metrics?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ev.metrics.map((m, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{m}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.module_type === "algorithm") {
    const alg = a as AlgorithmAnalysis;
    return (
      <div className="flex flex-col gap-3 text-sm">
        {alg.purpose && (
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Purpose</p>
            <p className="text-gray-700">{alg.purpose}</p>
          </div>
        )}
        {alg.complexity && (
          <p className="text-gray-500">Complexity: <span className="font-mono text-gray-700">{alg.complexity}</span></p>
        )}
      </div>
    );
  }

  return null;
}

export default function FigureDetailDrawer({
  item,
  paperTitle,
  onClose,
}: {
  item: ContentItem;
  paperTitle?: string;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<UserAnnotation[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAnnotations(item.id).then(setNotes).catch(console.error);
  }, [item.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      const ann = await addAnnotation(item.id, { note_text: noteInput.trim(), tags: [] });
      setNotes((prev) => [ann, ...prev]);
      setNoteInput("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(annId: string) {
    await deleteAnnotation(item.id, annId).catch(console.error);
    setNotes((prev) => prev.filter((n) => n.id !== annId));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            {paperTitle && (
              <p className="truncate text-xs text-gray-400">{paperTitle}</p>
            )}
            {item.caption && (
              <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-800">{item.caption}</p>
            )}
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3">
            <Link
              href={`/papers/${item.paper_id}`}
              className="text-xs text-blue-600 hover:underline"
              onClick={onClose}
            >
              Full analysis →
            </Link>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          {item.image_path && (
            <div className="border-b bg-gray-50 p-4">
              <img
                src={`${API_URL}/figures/${item.image_path}`}
                alt={item.caption ?? "figure"}
                className="mx-auto max-h-64 w-full rounded object-contain"
              />
            </div>
          )}

          {/* Analysis */}
          <div className="border-b p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Analysis</p>
            <AnalysisSummary item={item} />
          </div>

          {/* Notes */}
          <div className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notes ({notes.length})
            </p>
            <form onSubmit={handleAddNote} className="mb-3 flex gap-2">
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add a note…"
                className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={saving || !noteInput.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
              >
                {saving ? "…" : "Add"}
              </button>
            </form>
            <div className="flex flex-col gap-2">
              {notes.map((n) => (
                <div key={n.id} className="group flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <p className="text-gray-700">{n.note_text}</p>
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-gray-400">No notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
