"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContentItem, ArchFigureAnalysis, UserAnnotation } from "@/lib/types";
import { getAnnotations, addAnnotation, deleteAnnotation, getSimilarItems, retryAnalysis } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "analysis" | "related" | "notes";

function RetryButton({ itemId, onRetry }: { itemId: string; onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      await retryAnalysis(itemId);
      onRetry();
    } catch {
      setError("Retry failed. Please try again.");
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="self-start rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {retrying ? "Retrying..." : "Retry Analysis"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function ArchFigurePanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as ArchFigureAnalysis | null;
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const [notes, setNotes] = useState<UserAnnotation[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<ContentItem[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    if (activeTab === "notes") {
      getAnnotations(item.id).then(setNotes).catch(console.error);
    }
    if (activeTab === "related" && similar.length === 0) {
      setLoadingSimilar(true);
      getSimilarItems(item.id, 6)
        .then(setSimilar)
        .catch(console.error)
        .finally(() => setLoadingSimilar(false));
    }
  }, [activeTab, item.id]);

  const handleAddNote = async () => {
    if (!noteInput.trim()) return;
    setSaving(true);
    try {
      await addAnnotation(item.id, { note_text: noteInput.trim(), tags: [] });
      setNoteInput("");
      const updated = await getAnnotations(item.id);
      setNotes(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (annId: string) => {
    try {
      await deleteAnnotation(item.id, annId);
      setNotes((prev) => prev.filter((n) => n.id !== annId));
    } catch (e) {
      console.error("Failed to delete note:", e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Main layout: image + analysis */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {item.image_path && (
          <a
            href={`${API_URL}/figures/${item.image_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 lg:w-1/2"
          >
            <img
              src={`${API_URL}/figures/${item.image_path}`}
              alt="architecture figure"
              className="max-h-96 w-full cursor-zoom-in rounded-lg border object-contain bg-gray-50 transition hover:opacity-90"
            />
          </a>
        )}

        {a ? (
          <div className="flex flex-1 min-w-0 flex-col gap-4 text-sm">
            {/* Core problem — blue hero card */}
            <div className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg px-4 py-3 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Core problem</h3>
              <p className="text-blue-900 text-sm leading-relaxed">{a.core_problem}</p>
            </div>

            {/* Design insight — purple hero card */}
            <div className="border-l-4 border-purple-400 bg-purple-50 rounded-r-lg px-4 py-3 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-500 mb-1">Design insight</h3>
              <p className="text-purple-900 text-sm leading-relaxed">{a.design_insight}</p>
            </div>

            {/* Components — pill/card chips */}
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Components</h3>
              <div className="flex flex-wrap gap-2">
                {a.components.map((c) => (
                  <div
                    key={c.name}
                    className="bg-gray-100 rounded-lg px-3 py-1.5 text-xs"
                    title={c.role}
                  >
                    <span className="font-bold text-gray-800">{c.name}</span>
                    <span className="block text-gray-500 mt-0.5 max-w-[180px] truncate">{c.role}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Dataflow — horizontal flow if ≤4, vertical otherwise */}
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Dataflow</h3>
              {a.dataflow.length <= 4 ? (
                <div className="flex flex-wrap items-center gap-1">
                  {a.dataflow.map((step, i) => (
                    <div key={i} className="flex items-center gap-1 min-w-0">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 break-words">
                        <span className="font-semibold text-gray-500 mr-1">{i + 1}.</span>
                        {step}
                      </span>
                      {i < a.dataflow.length - 1 && (
                        <span className="text-gray-400 font-bold text-sm">→</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="flex flex-col gap-1">
                  {a.dataflow.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700">
                      <span className="flex-shrink-0 text-gray-400 font-semibold text-xs mt-0.5">{i + 1}.</span>
                      <span className="text-xs leading-relaxed">{step}</span>
                      {i < a.dataflow.length - 1 && (
                        <span className="block text-gray-300 text-xs ml-4">↓</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Tradeoffs — amber warning cards */}
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Tradeoffs</h3>
              <div className="flex flex-col gap-1.5">
                {a.tradeoffs.map((t, i) => (
                  <div
                    key={i}
                    className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 rounded text-sm text-amber-900"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </section>

            {/* Related systems — prominent blue chips */}
            {a.related_systems.length > 0 && (
              <section>
                <h3 className="font-semibold text-gray-800 mb-2">Related systems</h3>
                <div className="flex flex-wrap gap-1.5">
                  {a.related_systems.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-400">
              {item.processing_status === "processing"
                ? "AI analysis in progress..."
                : item.processing_status === "pending"
                ? "Awaiting classification."
                : "Analysis failed."}
            </p>
            {item.processing_status === "failed" && (
              <RetryButton itemId={item.id} onRetry={() => window.location.reload()} />
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-t pt-4">
        <div className="flex gap-1 border-b">
          {([
            ["analysis", "Design decisions"],
            ["related", "Related papers"],
            ["notes", "My notes"],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-b-2 border-gray-900 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeTab === "analysis" && a && (
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-800 mb-2">Tradeoffs recap</p>
              <div className="flex flex-col gap-1.5">
                {a.tradeoffs.map((t, i) => (
                  <div
                    key={i}
                    className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 rounded text-sm text-amber-900"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "related" && (
            <div>
              {loadingSimilar ? (
                <p className="text-sm text-gray-400">Finding similar papers...</p>
              ) : similar.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No similar papers found yet. Similar papers appear after multiple arch figures
                  have been analyzed.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {similar.map((s) => (
                    <Link
                      key={s.id}
                      href={`/papers/${s.paper_id}`}
                      className="flex flex-col gap-2 rounded-lg border bg-gray-50 p-3 text-sm hover:bg-white hover:shadow-sm transition"
                    >
                      {s.image_path && (
                        <img
                          src={`${API_URL}/figures/${s.image_path}`}
                          alt="arch figure"
                          className="aspect-video w-full rounded object-contain bg-white"
                        />
                      )}
                      <p className="line-clamp-2 text-xs text-gray-600">
                        {(s.analysis_json as ArchFigureAnalysis | null)?.core_problem ??
                          s.caption ??
                          "Arch figure"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <button
                  onClick={handleAddNote}
                  disabled={saving || !noteInput.trim()}
                  className="self-end rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>

              {notes.length === 0 ? (
                <p className="text-sm text-gray-400">No notes yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3"
                    >
                      <p className="flex-1 text-sm text-gray-700">{note.note_text}</p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
