"use client";

import { useEffect, useState } from "react";
import type { Topic, ModuleType } from "@/lib/types";
import { getTopic, updatePaperProgress } from "@/lib/api";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";
import PaperProgressRow from "./PaperProgressRow";

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

  const handleToggleModule = async (paperId: string, module: string, done: boolean) => {
    if (!topic) return;
    const tp = topic.papers?.find((p) => p.paper_id === paperId);
    if (!tp) return;

    const updated = { ...tp.progress_json, [module]: done };
    await updatePaperProgress(topicId, paperId, updated);
    setTopic((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        papers: prev.papers?.map((p) =>
          p.paper_id === paperId ? { ...p, progress_json: updated } : p
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{topic.name}</h1>
          {topic.description && (
            <p className="mt-1 text-sm text-gray-500">{topic.description}</p>
          )}
        </div>
        <StudyFocusSelector value={focus} onChange={setFocus} />
      </div>

      {papers.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          No papers in this topic yet.
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-white">
          {papers.map((tp) => (
            <div key={tp.paper_id} className="px-5">
              <PaperProgressRow
                tp={tp}
                visibleModules={focusModules}
                onToggle={handleToggleModule}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
