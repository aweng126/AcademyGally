"use client";

import { useEffect, useState } from "react";
import type { ContentItem, ModuleType } from "@/lib/types";
import { getContent } from "@/lib/api";
import FigureGrid from "./FigureGrid";
import CompareView from "./CompareView";

type ActiveTab = ModuleType | "compare";

const MODULE_TABS: { value: ActiveTab; label: string }[] = [
  { value: "arch_figure", label: "Arch figures" },
  { value: "abstract", label: "Abstract" },
  { value: "eval_figure", label: "Eval figures" },
  { value: "algorithm", label: "Algorithm" },
  { value: "compare", label: "Compare" },
];

export default function BrowseByModuleView() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("arch_figure");
  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (activeTab === "compare") return;
    setItems([]);
    getContent({ module_type: activeTab as ModuleType }).then(setItems).catch(console.error);
  }, [activeTab]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b pb-3">
        {MODULE_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeTab === value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "compare" ? (
        <CompareView />
      ) : (
        <FigureGrid items={items} />
      )}
    </div>
  );
}
