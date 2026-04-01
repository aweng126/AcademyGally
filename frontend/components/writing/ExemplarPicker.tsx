"use client";

import { useEffect, useState } from "react";
import type { ContentItem, Paper } from "@/lib/types";
import { getContent, getPapers } from "@/lib/api";

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function ExemplarPicker({ selected, onChange }: Props) {
  const [abstracts, setAbstracts] = useState<ContentItem[]>([]);
  const [paperMap, setPaperMap] = useState<Record<string, Paper>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getContent({ module_type: "abstract" }), getPapers()])
      .then(([items, papers]) => {
        setAbstracts(items);
        const map: Record<string, Paper> = {};
        papers.forEach((p) => { map[p.id] = p; });
        setPaperMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = abstracts.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const paper = paperMap[item.paper_id];
    return (
      (paper?.title ?? "").toLowerCase().includes(s) ||
      (item.caption ?? "").toLowerCase().includes(s)
    );
  });

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length < 5) {
      onChange([...selected, id]);
    }
  }

  if (loading) return <p className="text-xs text-gray-400">Loading abstracts…</p>;

  if (abstracts.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-400">
        No analyzed abstracts yet. Upload a paper first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Search by title or keyword…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
        ) : (
          filtered.map((item) => {
            const paper = paperMap[item.paper_id];
            const isSelected = selected.includes(item.id);
            const isDisabled = !isSelected && selected.length >= 5;
            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-start gap-2.5 px-3 py-2 transition ${
                  isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                } ${isSelected ? "bg-blue-50" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => toggle(item.id)}
                  className="mt-0.5 shrink-0 accent-blue-600"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 line-clamp-1">
                    {paper?.title || "Untitled"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[paper?.venue, paper?.year].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </label>
            );
          })
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-blue-600">{selected.length}/5 selected as reference</p>
      )}
    </div>
  );
}
