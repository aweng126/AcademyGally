"use client";

import { useState } from "react";
import type { ContentItem } from "@/lib/types";
import FigureDetailDrawer from "./FigureDetailDrawer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function FigureCard({ item, paperTitle }: { item: ContentItem; paperTitle?: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        ) : (
          <div className="aspect-video w-full rounded bg-gray-100" />
        )}
        {item.caption && (
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
