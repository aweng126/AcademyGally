"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContentItem, ArchFigureAnalysis } from "@/lib/types";
import { getContent } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ViewMode = "grid" | "table";

function exportMarkdown(items: ContentItem[]) {
  const header = "| Paper ID | Core Problem | Key Tradeoff | Related Systems |\n| --- | --- | --- | --- |";
  const rows = items.map((item) => {
    const a = item.analysis_json as ArchFigureAnalysis | null;
    if (!a) return `| ${item.paper_id} | — | — | — |`;
    const coreProblem = a.core_problem.replace(/\|/g, "\\|");
    const keyTradeoff = (a.tradeoffs[0] ?? "—").replace(/\|/g, "\\|");
    const relatedSystems = a.related_systems.slice(0, 5).join(", ").replace(/\|/g, "\\|");
    return `| ${item.paper_id} | ${coreProblem} | ${keyTradeoff} | ${relatedSystems} |`;
  });
  const mdContent = [header, ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([mdContent], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "comparison.md";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CompareView() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [venue, setVenue] = useState("");
  const [inputVenue, setInputVenue] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    const params: { module_type: string; venue?: string } = { module_type: "arch_figure" };
    if (venue) params.venue = venue;
    getContent(params).then(setItems).catch(console.error);
  }, [venue]);

  const activeBtn = "bg-gray-900 text-white rounded px-2 py-1 text-sm font-medium";
  const inactiveBtn = "border border-gray-300 text-gray-600 rounded px-2 py-1 text-sm hover:bg-gray-50";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Filter by venue (e.g. OSDI)"
          value={inputVenue}
          onChange={(e) => setInputVenue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setVenue(inputVenue)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 w-56"
        />
        <button
          onClick={() => setVenue(inputVenue)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Filter
        </button>
        {venue && (
          <button
            onClick={() => { setVenue(""); setInputVenue(""); }}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Clear
          </button>
        )}

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? activeBtn : inactiveBtn}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={viewMode === "table" ? activeBtn : inactiveBtn}
          >
            Table
          </button>
        </div>

        {viewMode === "table" && items.length > 0 && (
          <button
            onClick={() => exportMarkdown(items)}
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Export MD
          </button>
        )}

        <span className="ml-auto text-sm text-gray-400">{items.length} arch figures</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          No arch figures available yet.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const a = item.analysis_json as ArchFigureAnalysis | null;
            return (
              <Link
                key={item.id}
                href={`/papers/${item.paper_id}`}
                className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition"
              >
                {item.image_path && (
                  <img
                    src={`${API_URL}/figures/${item.image_path}`}
                    alt="arch figure"
                    className="aspect-video w-full rounded object-contain bg-gray-50"
                  />
                )}
                {a && (
                  <div className="flex flex-col gap-2 text-sm">
                    <p className="font-medium text-gray-800 line-clamp-2">{a.core_problem}</p>
                    <p className="text-gray-500 line-clamp-2 text-xs">{a.design_insight}</p>
                    {a.related_systems.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.related_systems.slice(0, 4).map((s) => (
                          <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.tradeoffs.slice(0, 2).map((t, i) => (
                        <span key={i} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                          {t.length > 60 ? t.slice(0, 57) + "…" : t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Paper", "Core Problem", "Design Insight", "Components", "Key Tradeoff", "Related Systems"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b-2 border-gray-200 bg-gray-50 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const a = item.analysis_json as ArchFigureAnalysis | null;
                const cellClass = "px-3 py-2 border-b border-gray-100 align-top";
                if (!a) {
                  return (
                    <tr key={item.id}>
                      <td className={cellClass}>
                        <Link href={`/papers/${item.paper_id}`} className="text-blue-600 hover:underline text-xs">
                          Paper →
                        </Link>
                      </td>
                      <td className={cellClass} colSpan={5}>
                        <span className="text-gray-400">—</span>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className={`${cellClass} sticky left-0 bg-white`}>
                      <Link href={`/papers/${item.paper_id}`} className="text-blue-600 hover:underline text-xs whitespace-nowrap">
                        Paper →
                      </Link>
                    </td>
                    <td className={`${cellClass} max-w-xs`}>
                      <span className="text-gray-800">{a.core_problem}</span>
                    </td>
                    <td className={`${cellClass} max-w-xs`}>
                      <span className="text-gray-600">{a.design_insight}</span>
                    </td>
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-1">
                        {a.components.map((c) => (
                          <span key={c.name} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={`${cellClass} max-w-xs`}>
                      <span className="text-gray-600">
                        {a.tradeoffs[0]
                          ? a.tradeoffs[0].length > 80
                            ? a.tradeoffs[0].slice(0, 80) + "…"
                            : a.tradeoffs[0]
                          : "—"}
                      </span>
                    </td>
                    <td className={cellClass}>
                      <div className="flex flex-wrap gap-1">
                        {a.related_systems.slice(0, 5).map((s) => (
                          <span key={s} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
