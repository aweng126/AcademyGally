"use client";

import { useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics, addPaperToTopic, createTopic, ApiError } from "@/lib/api";

interface Props {
  paperId: string;
  compact?: boolean;
  onTopicsChange?: (topics: { id: string; name: string }[]) => void;
}

export default function AddToTopicButton({ paperId, compact = false, onTopicsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  // New topic creation
  const [showCreate, setShowCreate] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Fetch topics every time the dropdown opens so the list is always fresh
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getTopics()
      .then((ts) => {
        setTopics(ts);
        const alreadyIn = new Set(
          ts
            .filter((t) => t.papers?.some((p) => p.paper_id === paperId))
            .map((t) => t.id)
        );
        setAdded(alreadyIn);
        onTopicsChange?.(
          ts.filter((t) => alreadyIn.has(t.id)).map((t) => ({ id: t.id, name: t.name }))
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, paperId]);

  // Focus create input when form appears
  useEffect(() => {
    if (showCreate) createInputRef.current?.focus();
  }, [showCreate]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
        setNewTopicName("");
        setCreateError(null);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const notifyChange = (nextAdded: Set<string>, allTopics: Topic[]) => {
    onTopicsChange?.(
      allTopics.filter((t) => nextAdded.has(t.id)).map((t) => ({ id: t.id, name: t.name }))
    );
  };

  const handleAdd = async (topicId: string) => {
    if (added.has(topicId) || adding) return;
    setAdding(topicId);
    setAddError(null);
    try {
      await addPaperToTopic(topicId, { paper_id: paperId, order: 999 });
      const next = new Set([...added, topicId]);
      setAdded(next);
      notifyChange(next, topics);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const next = new Set([...added, topicId]);
        setAdded(next);
        notifyChange(next, topics);
      } else {
        setAddError("Failed to add. Please try again.");
      }
    } finally {
      setAdding(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const topic = await createTopic({ name: newTopicName.trim() });
      const updatedTopics = [...topics, topic];
      setTopics(updatedTopics);
      // Immediately add this paper to the new topic
      await addPaperToTopic(topic.id, { paper_id: paperId, order: 999 });
      const next = new Set([...added, topic.id]);
      setAdded(next);
      notifyChange(next, updatedTopics);
      setNewTopicName("");
      setShowCreate(false);
    } catch {
      setCreateError("Failed to create topic. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700"
            : "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        }
      >
        + Topic
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border bg-white shadow-lg">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Add to Topic
          </div>

          {addError && (
            <p className="border-b px-3 py-2 text-xs text-red-500">{addError}</p>
          )}

          {loading ? (
            <p className="px-3 py-3 text-xs text-gray-400">Loading...</p>
          ) : topics.length === 0 && !showCreate ? (
            <p className="px-3 py-3 text-xs text-gray-400">No topics yet.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {topics.map((topic) => {
                const isAdded = added.has(topic.id);
                const isAdding = adding === topic.id;
                return (
                  <li key={topic.id}>
                    <button
                      onClick={() => handleAdd(topic.id)}
                      disabled={isAdded || !!isAdding}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                        isAdded
                          ? "cursor-default text-green-600"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{topic.name}</span>
                      <span className="ml-2 shrink-0 text-xs">
                        {isAdding ? "…" : isAdded ? "✓" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Create new topic */}
          <div className="border-t">
            {showCreate ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-1.5 p-2">
                <input
                  ref={createInputRef}
                  value={newTopicName}
                  onChange={(e) => { setNewTopicName(e.target.value); setCreateError(null); }}
                  placeholder="Topic name"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <div className="flex gap-1">
                  <button
                    type="submit"
                    disabled={creating || !newTopicName.trim()}
                    className="flex-1 rounded bg-gray-900 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                  >
                    {creating ? "Creating…" : "Create & Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setNewTopicName(""); setCreateError(null); }}
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
              >
                <span className="text-base leading-none">+</span>
                New topic
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
