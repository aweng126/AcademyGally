"use client";

import { useEffect, useState } from "react";
import type { Paper, ModuleType } from "@/lib/types";
import { getFullAnalysis } from "@/lib/api";
import ModuleAnalysisPanel from "./ModuleAnalysisPanel";
import StatusBadge from "@/components/shared/StatusBadge";

const MODULE_ORDER: ModuleType[] = ["abstract", "arch_figure", "eval_figure", "algorithm"];

export default function FullAnalysisPage({ paperId }: { paperId: string }) {
  const [paper, setPaper] = useState<Paper | null>(null);

  useEffect(() => {
    getFullAnalysis(paperId).then(setPaper).catch(console.error);
  }, [paperId]);

  if (!paper) return <p className="p-6 text-sm text-gray-400">Loading...</p>;

  const sortedItems = [...(paper.content_items ?? [])].sort(
    (a, b) => MODULE_ORDER.indexOf(a.module_type) - MODULE_ORDER.indexOf(b.module_type)
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold">{paper.title}</h1>
          <StatusBadge status={paper.processing_status} />
        </div>
        <p className="text-sm text-gray-500">
          {paper.authors} · {paper.venue} {paper.year}
        </p>
      </header>
      {sortedItems.map((item) => (
        <ModuleAnalysisPanel key={item.id} item={item} />
      ))}
    </div>
  );
}
