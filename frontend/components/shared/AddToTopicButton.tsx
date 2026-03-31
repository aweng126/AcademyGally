"use client";

import { useEffect, useRef, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics, addPaperToTopic } from "@/lib/api";

interface Props {
  paperId: string;
  /** Optional: compact icon-only style for use in dense layouts */
  compact?: boolean;
}

export default function AddToTopicButton({ paperId, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Fetch topics when dropdown opens for the first time
  useEffect(() => {
    if (!open) return;
    if (topics.length > 0) return;
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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, paperId, topics.length]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAdd = async (topicId: string) => {
    if (added.has(topicId) || adding) return;
    setAdding(topicId);
    try {
      // order = large number so new papers go to the end
      await addPaperToTopic(topicId, { paper_id: paperId, order: 999 });
      setAdded((prev) => new Set([...prev, topicId]));
    } catch {
      // 409 = already in topic — still mark as added
      setAdded((prev) => new Set([...prev, topicId]));
    } finally {
      setAdding(null);
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
        + Add to Topic
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border bg-white shadow-lg">
          <div className="border-b px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Topics
          </div>

          {loading ? (
            <p className="px-3 py-3 text-xs text-gray-400">Loading...</p>
          ) : topics.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">
              No topics yet — create one in the Topic study tab.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {topics.map((topic) => {
                const isAdded = added.has(topic.id);
                const isAdding = adding === topic.id;
                return (
                  <li key={topic.id}>
                    <button
                      onClick={() => handleAdd(topic.id)}
                      disabled={isAdded || isAdding}
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
        </div>
      )}
    </div>
  );
}
