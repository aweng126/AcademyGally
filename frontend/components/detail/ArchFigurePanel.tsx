import type { ContentItem, ArchFigureAnalysis } from "@/lib/types";

export default function ArchFigurePanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as ArchFigureAnalysis | null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {item.image_path && (
        <img
          src={`http://localhost:8000/figures/${item.image_path}`}
          alt="architecture figure"
          className="max-h-96 w-full rounded-lg border object-contain lg:w-1/2"
        />
      )}
      {a && (
        <div className="flex flex-1 flex-col gap-4 text-sm">
          <section>
            <h3 className="font-semibold text-gray-800">Core problem</h3>
            <p className="mt-1 text-gray-600">{a.core_problem}</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800">Design insight</h3>
            <p className="mt-1 text-gray-600">{a.design_insight}</p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800">Components</h3>
            <ul className="mt-1 space-y-1">
              {a.components.map((c) => (
                <li key={c.name} className="text-gray-600">
                  <span className="font-medium text-gray-800">{c.name}</span> — {c.role}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800">Dataflow</h3>
            <ol className="mt-1 list-decimal pl-4 text-gray-600">
              {a.dataflow.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800">Tradeoffs</h3>
            <ul className="mt-1 list-disc pl-4 text-gray-600">
              {a.tradeoffs.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </section>
          {a.related_systems.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800">Related systems</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {a.related_systems.map((s) => (
                  <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
