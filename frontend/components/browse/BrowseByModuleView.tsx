"use client";

import { useEffect, useState } from "react";
import type { ContentItem, ModuleType } from "@/lib/types";
import { getContent } from "@/lib/api";
import FigureGrid from "./FigureGrid";

const MODULE_TABS: { value: ModuleType; label: string }[] = [
  { value: "arch_figure", label: "Arch figures" },
  { value: "abstract", label: "Abstract" },
  { value: "eval_figure", label: "Eval figures" },
  { value: "algorithm", label: "Algorithm" },
];

export default function BrowseByModuleView() {
  const [activeModule, setActiveModule] = useState<ModuleType>("arch_figure");
  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    getContent({ module_type: activeModule }).then(setItems).catch(console.error);
  }, [activeModule]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b pb-3">
        {MODULE_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveModule(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeModule === value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <FigureGrid items={items} />
    </div>
  );
}
