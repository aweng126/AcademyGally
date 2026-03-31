import type { ContentItem, EvalFigureAnalysis } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function EvalFigurePanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as EvalFigureAnalysis | null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {item.image_path && (
        <img
          src={`${API_URL}/figures/${item.image_path}`}
          alt="eval figure"
          className="max-h-72 w-full rounded-lg border object-contain bg-gray-50 lg:w-1/2"
        />
      )}
      {a ? (
        <div className="flex flex-1 flex-col gap-3 text-sm">
          <p>
            <span className="font-medium">Headline: </span>
            <span className="text-gray-700">{a.headline_result}</span>
          </p>
          <p>
            <span className="font-medium">Workload: </span>
            <span className="text-gray-700">{a.workload_desc}</span>
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="font-medium">Metrics:</span>
            {a.metrics.map((m) => (
              <span key={m} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {m}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="font-medium">Baselines:</span>
            {a.baselines.map((b) => (
              <span key={b} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {b}
              </span>
            ))}
          </div>
          {a.caveats.length > 0 && (
            <section>
              <p className="font-medium text-gray-800">Caveats</p>
              <ul className="mt-1 list-disc pl-4 text-gray-500">
                {a.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Analysis pending.</p>
      )}
    </div>
  );
}
