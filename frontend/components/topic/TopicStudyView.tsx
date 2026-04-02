"use client";

import { useEffect, useState } from "react";
import type { Topic } from "@/lib/types";
import { getTopics, createTopic } from "@/lib/api";
import TopicCard from "./TopicCard";
import { TopicCardSkeleton } from "@/components/shared/Skeleton";

export default function TopicStudyView() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
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
        <div />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <TopicCardSkeleton key={i} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => (
          <TopicCard key={t.id} topic={t} />
        ))}
      </div>

      {!loading && topics.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <div className="text-5xl">📚</div>
          <div>
            <p className="text-lg font-semibold text-gray-700">No topics yet</p>
            <p className="mt-1 text-sm text-gray-500">Create a topic to organise papers and track your reading progress.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            + New Topic
          </button>
        </div>
      )}
    </div>
  );
}
