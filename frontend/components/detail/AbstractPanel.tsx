import type { ContentItem, AbstractAnalysis } from "@/lib/types";

export default function AbstractPanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as AbstractAnalysis | null;
  if (!a) return null;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-800">Problem statement</h3>
        <p className="mt-1 text-gray-600">{a.problem_statement}</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-800">Proposed approach</h3>
        <p className="mt-1 text-gray-600">{a.proposed_approach}</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-800">Key contributions</h3>
        <ul className="mt-1 list-disc pl-4 text-gray-600">
          {a.key_contributions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-800">Evaluation summary</h3>
        <p className="mt-1 text-gray-600">{a.evaluation_summary}</p>
      </section>
      <div className="flex flex-wrap gap-1">
        {a.keywords.map((k) => (
          <span key={k} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
