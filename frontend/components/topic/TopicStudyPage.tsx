"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Topic, ModuleType } from "@/lib/types";
import { getTopic } from "@/lib/api";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";
import SeriesPaperRow from "./SeriesPaperRow";

const FOCUS_MODULE_MAP: Record<StudyFocus, ModuleType[]> = {
  all: ["abstract", "arch_figure", "eval_figure"],
  abstract: ["abstract"],
  arch_figure: ["arch_figure"],
  eval_figure: ["eval_figure"],
};

export default function TopicStudyPage({ topicId }: { topicId: string }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [focus, setFocus] = useState<StudyFocus>("all");
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="p-6 text-sm text-gray-400">Loading...</p>;
  if (!topic) return <p className="p-6 text-sm text-gray-400">Topic not found.</p>;

  const papers = [...(topic.papers ?? [])].sort((a, b) => a.order - b.order);
  const focusModules = FOCUS_MODULE_MAP[focus];

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/?view=topic" className="mb-2 block text-sm text-gray-500 hover:text-gray-800">
            ← Topics
          </Link>
          <h1 className="text-xl font-bold">{topic.name}</h1>
          {topic.description && (
            <p className="mt-1 text-sm text-gray-500">{topic.description}</p>
          )}
          <p className="mt-0.5 text-xs text-gray-400">{papers.length} papers</p>
        </div>
        <StudyFocusSelector value={focus} onChange={setFocus} />
      </div>

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
          {papers.map((tp) => (
            <SeriesPaperRow
              key={tp.paper_id}
              tp={tp}
              topicId={topicId}
              visibleModules={focusModules}
              onProgressUpdate={handleProgressUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
