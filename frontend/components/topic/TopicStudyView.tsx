"use client";

import { useEffect, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics } from "@/lib/api";
import TopicCard from "./TopicCard";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";

export default function TopicStudyView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [focus, setFocus] = useState<StudyFocus>("all");

  useEffect(() => {
    setFocus(getStoredFocus());
    getTopics().then(setTopics).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <StudyFocusSelector value={focus} onChange={setFocus} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <TopicCard key={t.id} topic={t} />
        ))}
      </div>
    </div>
  );
}
