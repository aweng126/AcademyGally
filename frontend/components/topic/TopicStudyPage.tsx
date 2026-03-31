"use client";

import { useEffect, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics } from "@/lib/api";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";
import PaperProgressRow from "./PaperProgressRow";

export default function TopicStudyPage({ topicId }: { topicId: string }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [focus, setFocus] = useState<StudyFocus>("all");

  useEffect(() => {
    setFocus(getStoredFocus());
    // TODO: replace with getTopic(topicId) once backend is ready
    getTopics()
      .then((ts) => setTopic(ts.find((t) => t.id === topicId) ?? null))
      .catch(console.error);
  }, [topicId]);

  if (!topic) return <p className="text-sm text-gray-400">Loading...</p>;

  const papers = [...(topic.papers ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{topic.name}</h2>
        <StudyFocusSelector value={focus} onChange={setFocus} />
      </div>
      <div className="divide-y rounded-lg border bg-white">
        {papers.map((tp) => (
          <div key={tp.paper_id} className="px-4">
            <PaperProgressRow tp={tp} />
          </div>
        ))}
      </div>
    </div>
  );
}
