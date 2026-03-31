"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContentItem, ArchFigureAnalysis, UserAnnotation } from "@/lib/types";
import { getAnnotations, addAnnotation, deleteAnnotation, getSimilarItems } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Tab = "analysis" | "related" | "notes";

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
          <div className="flex flex-1 flex-col gap-4 text-sm">
            <section>
              <h3 className="font-semibold text-gray-800">Core problem</h3>
              <p className="mt-1 text-gray-600">{a.core_problem}</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800">Design insight</h3>
              <p className="mt-1 text-gray-600">{a.design_insight}</p>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800">Components</h3>
              <ul className="mt-1 space-y-1">
                {a.components.map((c) => (
                  <li key={c.name} className="text-gray-600">
                    <span className="font-medium text-gray-800">{c.name}</span> — {c.role}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800">Dataflow</h3>
              <ol className="mt-1 list-decimal pl-4 text-gray-600">
                {a.dataflow.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800">Tradeoffs</h3>
              <ul className="mt-1 list-disc pl-4 text-gray-600">
                {a.tradeoffs.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
            {a.related_systems.length > 0 && (
              <section>
                <h3 className="font-semibold text-gray-800">Related systems</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.related_systems.map((s) => (
                    <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {item.processing_status === "processing"
              ? "AI analysis in progress..."
              : item.processing_status === "pending"
              ? "Awaiting classification."
              : "Analysis failed."}
          </p>
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
              <p className="font-medium text-gray-800">Tradeoffs recap</p>
              <ul className="mt-1 list-disc pl-4">
                {a.tradeoffs.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
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
