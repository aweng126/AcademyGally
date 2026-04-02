"use client";

import { useEffect, useState } from "react";
import type { ContentItem, ModuleType } from "@/lib/types";
import { getContent } from "@/lib/api";
import FigureGrid from "./FigureGrid";
import CompareView from "./CompareView";
import PhraseLibraryView from "./PhraseLibraryView";
import { FigureCardSkeleton } from "@/components/shared/Skeleton";

type ActiveTab = ModuleType | "compare" | "phrases";

const MODULE_TABS: { value: ActiveTab; label: string }[] = [
  { value: "arch_figure", label: "Arch figures" },
  { value: "abstract", label: "Abstract" },
  { value: "eval_figure", label: "Eval figures" },
  { value: "algorithm", label: "Algorithm" },
  { value: "compare", label: "Compare" },
  { value: "phrases", label: "Phrase Library" },
];

export default function BrowseByModuleView() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("arch_figure");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (activeTab === "compare" || activeTab === "phrases") return;
    setItems([]);
    setLoadingItems(true);
    getContent({ module_type: activeTab as ModuleType })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoadingItems(false));
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {MODULE_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeTab === value
                ? value === "phrases"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-900 text-white"
                : value === "phrases"
                ? "text-purple-600 hover:bg-purple-50"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "compare" ? (
        <CompareView />
      ) : activeTab === "phrases" ? (
        <PhraseLibraryView />
      ) : loadingItems ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <FigureCardSkeleton key={i} />)}
        </div>
      ) : (
        <FigureGrid items={items} />
      )}
    </div>
  );
}
