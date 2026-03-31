"use client";

import { useEffect, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics, createTopic } from "@/lib/api";
import TopicCard from "./TopicCard";
import StudyFocusSelector, { type StudyFocus, getStoredFocus } from "./StudyFocusSelector";

export default function TopicStudyView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [focus, setFocus] = useState<StudyFocus>("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setFocus(getStoredFocus());
    getTopics()
      .then(setTopics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const t = await createTopic({ name: name.trim(), description: description.trim() || undefined });
      setTopics((prev) => [t, ...prev]);
      setName(""); setDescription(""); setShowForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create topic.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <StudyFocusSelector value={focus} onChange={setFocus} />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showForm ? "Cancel" : "+ New Topic"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Topic name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            {createError && (
              <p className="text-xs text-red-500">{createError}</p>
            )}
            <button
              type="submit"
              disabled={creating}
              className="self-start rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Topic"}
            </button>
          </div>
        </form>
      )}

      {loading && topics.length === 0 && (
        <p className="text-sm text-gray-400">Loading...</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <TopicCard key={t.id} topic={t} />
        ))}
      </div>

      {!loading && topics.length === 0 && (
        <p className="text-sm text-gray-400">No topics yet. Create one to start organising your reading.</p>
      )}
    </div>
  );
}
