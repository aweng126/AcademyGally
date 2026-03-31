"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContentItem, ArchFigureAnalysis } from "@/lib/types";
import { getContent } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function CompareView() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [venue, setVenue] = useState("");
  const [inputVenue, setInputVenue] = useState("");

  useEffect(() => {
    const params: { module_type: string; venue?: string } = { module_type: "arch_figure" };
    if (venue) params.venue = venue;
    getContent(params).then(setItems).catch(console.error);
  }, [venue]);

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
        <span className="ml-auto text-sm text-gray-400">{items.length} arch figures</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
          No arch figures available yet.
        </div>
      ) : (
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
      )}
    </div>
  );
}
