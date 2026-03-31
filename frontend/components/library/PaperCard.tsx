import Link from "next/link";
import type { Paper } from "@/lib/types";
import StatusBadge from "@/components/shared/StatusBadge";
import ModuleChip from "./ModuleChip";
import AddToTopicButton from "@/components/shared/AddToTopicButton";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function PaperCard({ paper }: { paper: Paper }) {
  const items = paper.content_items ?? [];
  const archFigure = items.find((i) => i.module_type === "arch_figure" && i.image_path);
  const hasUnclassified =
    paper.processing_status === "done" && items.some((i) => i.module_type === "other");

  return (
    <div className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Arch figure thumbnail */}
      {archFigure?.image_path ? (
        <img
          src={`${API_URL}/figures/${archFigure.image_path}`}
          alt="arch figure thumbnail"
          className="h-20 w-28 shrink-0 rounded object-cover bg-gray-50"
        />
      ) : (
        <div className="h-20 w-28 shrink-0 rounded bg-gray-100" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/papers/${paper.id}`}
          className="truncate font-medium hover:underline"
        >
          {paper.title}
        </Link>
        <p className="text-sm text-gray-500">
          {[paper.authors, paper.venue, paper.year].filter(Boolean).join(" · ")}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={paper.processing_status} />
          {(["arch_figure", "abstract", "eval_figure"] as const).map((mt) => {
            const item = items.find((i) => i.module_type === mt);
            return item ? (
              <ModuleChip key={mt} moduleType={mt} status={item.processing_status} />
            ) : null;
          })}
        </div>

        {/* Action links */}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {hasUnclassified && (
            <Link
              href={`/papers/${paper.id}/confirm`}
              className="text-xs text-blue-600 hover:underline"
            >
              Classify figures →
            </Link>
          )}
          {paper.processing_status === "done" && (
            <AddToTopicButton paperId={paper.id} compact />
          )}
        </div>
      </div>
    </div>
  );
}
