import Link from "next/link";
import type { Paper } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleChip from "./ModuleChip";

export default function PaperCard({ paper }: { paper: Paper }) {
  const archFigure = paper.content_items?.find((i) => i.module_type === "arch_figure");

  return (
    <Link
      href={`/papers/${paper.id}`}
      className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      {archFigure?.image_path && (
        <img
          src={`http://localhost:8000/figures/${archFigure.image_path}`}
          alt="arch figure thumbnail"
          className="h-20 w-28 shrink-0 rounded object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-medium">{paper.title}</p>
        <p className="text-sm text-gray-500">
          {paper.venue} {paper.year}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge status={paper.processing_status} />
          {(["arch_figure", "abstract", "eval_figure"] as const).map((mt) => {
            const item = paper.content_items?.find((i) => i.module_type === mt);
            if (!item) return null;
            return <ModuleChip key={mt} moduleType={mt} status={item.processing_status} />;
          })}
        </div>
      </div>
    </Link>
  );
}
