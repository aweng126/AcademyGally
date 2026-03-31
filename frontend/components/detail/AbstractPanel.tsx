import type { ContentItem, AbstractAnalysis } from "@/lib/types";

export default function AbstractPanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as AbstractAnalysis | null;

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* Raw abstract text (from extraction) */}
      {item.caption && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Original text
          </p>
          <p className="leading-relaxed text-gray-700">{item.caption}</p>
        </div>
      )}

      {/* Structured AI analysis */}
      {a ? (
        <>
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

          {a.novelty_claim && (
            <section>
              <h3 className="font-semibold text-gray-800">Novelty claim</h3>
              <p className="mt-1 text-gray-600">{a.novelty_claim}</p>
            </section>
          )}

          {a.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {a.keywords.map((k) => (
                <span key={k} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                  {k}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400">
          {item.processing_status === "processing"
            ? "AI analysis in progress..."
            : item.processing_status === "pending"
            ? "Queued for analysis."
            : item.caption
            ? "Analysis failed — raw text shown above."
            : "No abstract found in this PDF."}
        </p>
      )}
    </div>
  );
}
