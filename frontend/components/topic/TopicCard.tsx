import Link from "next/link";
import type { Topic } from "@/lib/types";
import ProgressBar from "@/components/shared/ProgressBar";

function overallProgress(topic: Topic): { pct: number; done: number; total: number } {
  const papers = topic.papers ?? [];
  if (!papers.length) return { pct: 0, done: 0, total: 0 };
  const totals = papers.flatMap((tp) => Object.values(tp.progress_json));
  const done = totals.filter(Boolean).length;
  const total = totals.length;
  return { pct: total ? (done / total) * 100 : 0, done, total };
}

function topicStatus(pct: number): { label: string; color: string } {
  if (pct === 0) return { label: "Not started", color: "bg-gray-100 text-gray-500" };
  if (pct === 100) return { label: "Completed", color: "bg-green-100 text-green-700" };
  return { label: "In progress", color: "bg-blue-100 text-blue-700" };
}

export default function TopicCard({ topic }: { topic: Topic }) {
  const { pct, done, total } = overallProgress(topic);
  const status = topicStatus(pct);
  const papers = topic.papers ?? [];
  const recentPaper = papers[0]?.paper;
  const createdAt = new Date(topic.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/topics/${topic.id}`}
      className="flex flex-col gap-3 rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{topic.name}</p>
          {topic.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{topic.description}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      <ProgressBar value={pct} />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {papers.length} paper{papers.length !== 1 ? "s" : ""}
          {total > 0 && <span className="ml-1.5 text-gray-300">· {done}/{total} modules</span>}
        </span>
        <span>{createdAt}</span>
      </div>

      {recentPaper?.title && (
        <p className="line-clamp-1 rounded bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
          Latest: {recentPaper.title}
        </p>
      )}
    </Link>
  );
}
