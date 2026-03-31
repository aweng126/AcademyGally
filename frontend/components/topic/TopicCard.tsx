import Link from "next/link";
import type { Topic } from "@/lib/types";
import ProgressBar from "@/components/shared/ProgressBar";

function overallProgress(topic: Topic): number {
  const papers = topic.papers ?? [];
  if (!papers.length) return 0;
  const totals = papers.flatMap((tp) => Object.values(tp.progress_json));
  return totals.length ? (totals.filter(Boolean).length / totals.length) * 100 : 0;
}

function topicStatus(pct: number): string {
  if (pct === 0) return "Not started";
  if (pct === 100) return "Completed";
  return "In progress";
}

export default function TopicCard({ topic }: { topic: Topic }) {
  const pct = overallProgress(topic);

  return (
    <Link
      href={`/topics/${topic.id}`}
      className="flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{topic.name}</p>
          {topic.description && (
            <p className="mt-0.5 text-sm text-gray-500">{topic.description}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {topicStatus(pct)}
        </span>
      </div>
      <ProgressBar value={pct} />
      <p className="text-xs text-gray-400">{topic.papers?.length ?? 0} papers</p>
    </Link>
  );
}
