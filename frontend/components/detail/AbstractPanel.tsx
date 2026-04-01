"use client";

import { useState } from "react";
import type { ContentItem, AbstractAnalysis, AbstractRubric, KeyPhrase } from "@/lib/types";
import { retryAnalysis } from "@/lib/api";

const DIMENSION_LABELS: Record<string, string> = {
  problem_clarity: "Problem clarity",
  contribution_specificity: "Contribution specificity",
  novelty_claim_strength: "Novelty claim",
  evaluation_evidence_quality: "Evaluation evidence",
  writing_quality: "Writing quality",
};

function ScorePips({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= score
              ? score <= 2
                ? "bg-red-400"
                : score === 3
                ? "bg-yellow-400"
                : "bg-green-400"
              : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function RubricScorecard({ rubric }: { rubric: AbstractRubric }) {
  const dimensions = Object.keys(DIMENSION_LABELS) as (keyof AbstractRubric)[];
  const avg = dimensions.reduce((sum, d) => sum + rubric[d].score, 0) / dimensions.length;
  const avgColor = avg >= 4 ? "text-green-600" : avg >= 3 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Writing Quality Rubric</h3>
        <span className={`text-sm font-bold ${avgColor}`}>{avg.toFixed(1)} / 5</span>
      </div>
      <div className="divide-y divide-gray-100">
        {dimensions.map((dim) => {
          const { score, rationale } = rubric[dim];
          return (
            <div key={dim} className="flex flex-col gap-1 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{DIMENSION_LABELS[dim]}</span>
                <ScorePips score={score} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{rationale}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReAnalyzeButton({ itemId }: { itemId: string }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryAnalysis(itemId);
      window.location.reload();
    } catch {
      setRetrying(false);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={retrying}
      className="self-start text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 disabled:opacity-50"
    >
      {retrying ? "Re-analyzing…" : "Re-analyze to get writing rubric scores"}
    </button>
  );
}

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
          {/* Problem statement — blue hero card */}
          <div className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg px-4 py-3 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Problem statement</h3>
            <p className="text-blue-900 text-sm leading-relaxed">{a.problem_statement}</p>
          </div>

          {/* Proposed approach — green hero card */}
          <div className="border-l-4 border-green-400 bg-green-50 rounded-r-lg px-4 py-3 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-1">Proposed approach</h3>
            <p className="text-green-900 text-sm leading-relaxed">{a.proposed_approach}</p>
          </div>

          {/* Key contributions — numbered cards */}
          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Key contributions</h3>
            <ol className="flex flex-col gap-2">
              {a.key_contributions.map((c, i) => (
                <li key={i} className="flex gap-3 bg-gray-50 rounded px-3 py-2">
                  <span className="flex-shrink-0 font-semibold text-gray-400 text-xs mt-0.5">{i + 1}.</span>
                  <span className="text-gray-700 text-sm leading-relaxed">{c}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Evaluation summary — subtle background */}
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Evaluation summary</h3>
            <div className="bg-gray-50 rounded px-3 py-2">
              <p className="text-gray-600 text-sm leading-relaxed">{a.evaluation_summary}</p>
            </div>
          </section>

          {/* Novelty claim — highlight treatment */}
          {a.novelty_claim && (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600 mb-1">Novelty claim</p>
              <p className="text-yellow-900 text-sm leading-relaxed">{a.novelty_claim}</p>
            </div>
          )}

          {/* Keywords */}
          {a.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {a.keywords.map((k) => (
                <span key={k} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                  {k}
                </span>
              ))}
            </div>
          )}

          {/* Writing Rubric Scorecard */}
          {a.rubric && <RubricScorecard rubric={a.rubric} />}

          {/* Re-analyze prompt for old abstracts without rubric */}
          {!a.rubric && (
            <ReAnalyzeButton itemId={item.id} />
          )}

          {/* Writing Coach entry point */}
          <div className="flex items-center justify-between rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5">
            <p className="text-xs text-gray-500">Improve your own abstract writing</p>
            <a
              href={`/writing-coach?exemplar=${item.id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Use as writing exemplar →
            </a>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400">
          {item.processing_status === "processing"
            ? "AI analysis in progress..."
            : item.processing_status === "pending"
            ? "Queued for analysis."
            : item.processing_status === "failed"
            ? <span className="text-red-500">Analysis failed — please retry or check the PDF.</span>
            : item.caption
            ? "Analysis failed — raw text shown above."
            : "No abstract found in this PDF."}
        </p>
      )}
    </div>
  );
}
