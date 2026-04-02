"use client";

import { useState } from "react";
import type { ContentItem, AbstractAnalysis } from "@/lib/types";
import FigureDetailDrawer from "./FigureDetailDrawer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function AbstractPreview({ item }: { item: ContentItem }) {
  const a = item.analysis_json as AbstractAnalysis | null;
  return (
    <div className="flex aspect-video w-full flex-col justify-between rounded bg-blue-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">Abstract</p>
      <p className="line-clamp-5 text-xs leading-relaxed text-blue-900">
        {a?.problem_statement ?? item.caption ?? "Abstract"}
      </p>
      {a?.keywords && a.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {a.keywords.slice(0, 3).map((k, i) => (
            <span key={i} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-600">{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FigureCard({ item, paperTitle }: { item: ContentItem; paperTitle?: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isTextModule = !item.image_path;

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="flex w-full flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md text-left"
      >
        {item.image_path ? (
          <img
            src={`${API_URL}/figures/${item.image_path}`}
            alt={item.caption ?? "figure"}
            className="aspect-video w-full rounded object-contain bg-gray-50"
          />
        ) : isTextModule && item.module_type === "abstract" ? (
          <AbstractPreview item={item} />
        ) : (
          <div className="aspect-video w-full rounded bg-gray-100 flex items-center justify-center">
            <span className="text-xs text-gray-400">{item.module_type.replace("_", " ")}</span>
          </div>
        )}
        {item.caption && item.module_type !== "abstract" && (
          <p className="line-clamp-2 text-xs text-gray-600">{item.caption}</p>
        )}
      </button>

      {drawerOpen && (
        <FigureDetailDrawer
          item={item}
          paperTitle={paperTitle}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
