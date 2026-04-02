"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Topic, ModuleType } from "@/lib/types";
import { getTopic, updateTopic, deleteTopic, removePaperFromTopic, updatePaperOrder } from "@/lib/api";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";
import SeriesPaperRow from "./SeriesPaperRow";

const FOCUS_MODULE_MAP: Record<StudyFocus, ModuleType[]> = {
  all: ["abstract", "arch_figure", "eval_figure"],
  abstract: ["abstract"],
  arch_figure: ["arch_figure"],
  eval_figure: ["eval_figure"],
};

export default function TopicStudyPage({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [focus, setFocus] = useState<StudyFocus>("all");
  const [loading, setLoading] = useState(true);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setFocus(getStoredFocus());
    getTopic(topicId)
      .then(setTopic)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [topicId]);

  const handleProgressUpdate = (paperId: string, progress: Record<string, boolean>) => {
    setTopic((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        papers: prev.papers?.map((p) =>
          p.paper_id === paperId ? { ...p, progress_json: progress } : p
        ),
      };
    });
  };

  const handleStartEdit = () => {
    if (!topic) return;
    setEditName(topic.name);
    setEditDesc(topic.description ?? "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!topic || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateTopic(topicId, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setTopic((prev) => prev ? { ...prev, name: updated.name, description: updated.description } : prev);
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTopic(topicId);
      router.push("/?view=topic");
    } catch (e) {
      console.error(e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    try {
      await removePaperFromTopic(topicId, paperId);
      setTopic((prev) => {
        if (!prev) return prev;
        return { ...prev, papers: prev.papers?.filter((p) => p.paper_id !== paperId) };
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReorderPaper = async (paperId: string, direction: "up" | "down") => {
    if (!topic?.papers) return;
    const sorted = [...topic.papers].sort((a, b) => a.order - b.order);
    // Normalize: assign sequential indices to fix historical order=0 ties
    const normalized = sorted.map((p, i) => ({ ...p, order: i }));
    const idx = normalized.findIndex((p) => p.paper_id === paperId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= normalized.length) return;

    // Swap orders
    const newA = normalized[idx].order;
    const newB = normalized[swapIdx].order;
    normalized[idx] = { ...normalized[idx], order: newB };
    normalized[swapIdx] = { ...normalized[swapIdx], order: newA };

    // Optimistic update
    setTopic((prev) => prev ? { ...prev, papers: normalized } : prev);

    // Persist both swapped rows
    try {
      await Promise.all([
        updatePaperOrder(topicId, normalized[idx].paper_id, normalized[idx].order),
        updatePaperOrder(topicId, normalized[swapIdx].paper_id, normalized[swapIdx].order),
      ]);
    } catch (e) {
      console.error(e);
      // Revert on failure
      setTopic((prev) => prev ? { ...prev, papers: sorted } : prev);
    }
  };

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading...</p>;
  if (!topic) return <p className="p-6 text-sm text-gray-400">Topic not found.</p>;

  const papers = [...(topic.papers ?? [])].sort((a, b) => a.order - b.order);
  const focusModules = FOCUS_MODULE_MAP[focus];

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link href="/?view=topic" className="mb-2 block text-sm text-gray-500 hover:text-gray-800">
            ← Topics
          </Link>

          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-xl font-bold focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Topic name"
                autoFocus
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                className="resize-none rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="Description (optional)"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim()}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{topic.name}</h1>
                <button
                  onClick={handleStartEdit}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                  title="Edit topic"
                >
                  ✏
                </button>
              </div>
              {topic.description && (
                <p className="mt-1 text-sm text-gray-500">{topic.description}</p>
              )}
              <p className="mt-0.5 text-xs text-gray-400">{papers.length} papers</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StudyFocusSelector value={focus} onChange={setFocus} />
          {!editing && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-gray-400 hover:text-red-500 text-sm"
              title="Delete topic"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <span className="flex-1 text-red-800">Delete this topic? This cannot be undone.</span>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}

      {/* Papers series */}
      {papers.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          No papers in this topic yet. Add papers from the{" "}
          <Link href="/?view=library" className="text-blue-600 hover:underline">
            Library
          </Link>
          .
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-white overflow-hidden">
          {papers.map((tp, idx) => (
            <SeriesPaperRow
              key={tp.paper_id}
              tp={tp}
              topicId={topicId}
              visibleModules={focusModules}
              onProgressUpdate={handleProgressUpdate}
              onRemove={handleRemovePaper}
              onMoveUp={(pid) => handleReorderPaper(pid, "up")}
              onMoveDown={(pid) => handleReorderPaper(pid, "down")}
              isFirst={idx === 0}
              isLast={idx === papers.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
