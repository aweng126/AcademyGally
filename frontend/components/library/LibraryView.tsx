"use client";

import { useEffect, useState } from "react";
import type { Paper } from "@/lib/types";
import { getPapers } from "@/lib/api";
import PaperCard from "./PaperCard";

export default function LibraryView() {
  const [papers, setPapers] = useState<Paper[]>([]);

  useEffect(() => {
    getPapers().then(setPapers).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {papers.map((p) => (
        <PaperCard key={p.id} paper={p} />
      ))}
      {papers.length === 0 && (
        <p className="text-sm text-gray-400">No papers yet. Upload a PDF to get started.</p>
      )}
    </div>
  );
}
