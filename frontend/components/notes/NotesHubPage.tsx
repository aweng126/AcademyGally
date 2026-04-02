"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { NoteItem } from "@/lib/types";
import { getNotesByModule } from "@/lib/api";
import SummaryEditor from "./SummaryEditor";

type ModuleTab = "abstract" | "arch_figure" | "eval_figure" | "algorithm";

const MODULE_TABS: { value: ModuleTab; label: string }[] = [
  { value: "abstract", label: "Abstract" },
  { value: "arch_figure", label: "Arch Figure" },
  { value: "eval_figure", label: "Eval Figure" },
  { value: "algorithm", label: "Algorithm" },
];

const MODULE_COLORS: Record<ModuleTab, string> = {
  abstract: "bg-blue-50 text-blue-700 border-blue-200",
  arch_figure: "bg-purple-50 text-purple-700 border-purple-200",
  eval_figure: "bg-amber-50 text-amber-700 border-amber-200",
  algorithm: "bg-green-50 text-green-700 border-green-200",
};

function NoteCard({
  note,
  onAddToMaterials,
}: {
  note: NoteItem;
  onAddToMaterials: (text: string) => void;
}) {
  const date = new Date(note.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="group rounded-lg border border-gray-100 bg-white p-3.5 text-sm transition hover:border-gray-200 hover:shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/papers/${note.paper_id}`}
            className="block truncate font-medium text-gray-800 hover:underline"
          >
            {note.paper_title}
          </Link>
          {(note.venue || note.year) && (
            <p className="mt-0.5 text-xs text-gray-400">
              {[note.venue, note.year].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-400">{date}</span>
      </div>

      {note.item_caption && (
        <p className="mb-2 rounded bg-gray-50 px-2 py-1 text-xs italic text-gray-500 line-clamp-1">
          {note.item_caption}
        </p>
      )}

      <p className="leading-relaxed text-gray-700">{note.note_text}</p>

      <button
        onClick={() => onAddToMaterials(note.note_text)}
        className="mt-2.5 rounded px-2 py-0.5 text-xs font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
        title="Add to Accumulated Materials"
      >
        → 加入素材
      </button>
    </div>
  );
}

export default function NotesHubPage() {
  const [activeTab, setActiveTab] = useState<ModuleTab>("abstract");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMaterial, setPendingMaterial] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [summaryContent, setSummaryContent] = useState({ principles: "", materials: "" });

  useEffect(() => {
    setLoading(true);
    setNotes([]);
    setSearchQuery("");
    getNotesByModule(activeTab)
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab]);

  const filteredNotes = searchQuery.trim()
    ? notes.filter(
        (n) =>
          n.note_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.paper_title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-0 p-6">
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <Link href="/" className="mb-2 block text-sm text-gray-500 hover:text-gray-800">
            ← Library
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Notes Hub</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            汇聚所有笔记，提炼写作原则与积累素材
          </p>
        </div>
        <button
          onClick={() => {
            const sectionLabel = MODULE_TABS.find((t) => t.value === activeTab)?.label ?? activeTab;
            const lines: string[] = [`# Writing Notes — ${sectionLabel}`, ""];
            if (summaryContent.principles.trim()) {
              lines.push("## Writing Principles", "", summaryContent.principles.trim(), "");
            }
            if (summaryContent.materials.trim()) {
              lines.push("## Accumulated Materials", "", summaryContent.materials.trim(), "");
            }
            if (notes.length > 0) {
              lines.push("## Notes", "");
              notes.forEach((n) => {
                lines.push(`### ${n.paper_title}${n.venue || n.year ? ` (${[n.venue, n.year].filter(Boolean).join(" · ")})` : ""}`);
                if (n.item_caption) lines.push(`> ${n.item_caption}`);
                lines.push("", n.note_text, "");
              });
            }
            const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `notes-${activeTab}-${new Date().toISOString().slice(0, 10)}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Export .md
        </button>
      </div>

      {/* Module tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {MODULE_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === value
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
            {activeTab === value && notes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                {notes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 min-h-[60vh]">
        {/* Left: Notes list */}
        <div className="w-[38%] shrink-0 flex flex-col gap-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notes
            </p>
            {!loading && (
              <span className="text-xs text-gray-400">
                {filteredNotes.length !== notes.length
                  ? `${filteredNotes.length} / ${notes.length}`
                  : notes.length === 0 ? "No notes yet" : `${notes.length} note${notes.length > 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          {/* Search */}
          {notes.length > 0 && (
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes…"
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
            />
          )}

          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : notes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">No notes for this module yet.</p>
              <p className="mt-1 text-xs text-gray-300">
                Add notes from paper detail pages.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
              {filteredNotes.length === 0 ? (
                <p className="text-sm text-gray-400">No matching notes.</p>
              ) : (
                filteredNotes.map((note) => (
                  <NoteCard
                    key={note.annotation_id}
                    note={note}
                    onAddToMaterials={(text) => setPendingMaterial(text)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-100 shrink-0" />

        {/* Right: Summary editor */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              My Summary — {MODULE_TABS.find((t) => t.value === activeTab)?.label}
            </p>
          </div>
          <div className={`rounded-lg border ${MODULE_COLORS[activeTab]} overflow-hidden`}>
            <SummaryEditor
              moduleType={activeTab}
              pendingMaterial={pendingMaterial}
              onPendingMaterialConsumed={() => setPendingMaterial(null)}
              onContentChange={(p, m) => setSummaryContent({ principles: p, materials: m })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
