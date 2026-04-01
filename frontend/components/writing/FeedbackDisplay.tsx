"use client";

import { useState } from "react";
import type { CoachResponse, CoachIssue } from "@/lib/types";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-l-4 border-red-400 bg-red-50",
  moderate: "border-l-4 border-yellow-400 bg-yellow-50",
  minor: "border-l-4 border-gray-300 bg-gray-50",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  moderate: "bg-yellow-100 text-yellow-700",
  minor: "bg-gray-100 text-gray-600",
};

const SCORE_COLOR = (s: number) =>
  s >= 4 ? "text-green-600" : s >= 3 ? "text-yellow-600" : "text-red-600";

function IssueCard({ issue, index }: { issue: CoachIssue; index: number }) {
  return (
    <div className={`rounded-lg p-3 ${SEVERITY_STYLES[issue.severity] ?? "bg-gray-50"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            SEVERITY_BADGE[issue.severity] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {issue.severity}
        </span>
        <span className="text-xs font-medium text-gray-600">
          {issue.dimension.replace(/_/g, " ")}
        </span>
        {issue.exemplar_ref != null && (
          <span className="ml-auto text-xs text-blue-500">
            → see Exemplar {issue.exemplar_ref}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-800">{issue.description}</p>
      <p className="mt-1 text-xs text-gray-600">
        <span className="font-medium">Suggestion: </span>
        {issue.suggestion}
      </p>
    </div>
  );
}

export default function FeedbackDisplay({
  result,
  draftText,
}: {
  result: CoachResponse;
  draftText: string;
}) {
  const [showRewrite, setShowRewrite] = useState(false);
  const [copied, setCopied] = useState(false);

  const sortedIssues = [...result.issues].sort((a, b) => {
    const order = { critical: 0, moderate: 1, minor: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  function handleCopy() {
    navigator.clipboard.writeText(result.suggested_rewrite).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Overall score */}
      <div className="flex items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-gray-200">
          <span className={`text-2xl font-bold ${SCORE_COLOR(result.overall_score)}`}>
            {result.overall_score}
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Overall score</p>
          <p className="mt-0.5 text-sm text-gray-700 leading-relaxed">{result.summary}</p>
        </div>
      </div>

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Strengths
          </h3>
          <ul className="flex flex-col gap-1.5">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {sortedIssues.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Issues ({sortedIssues.length})
          </h3>
          <div className="flex flex-col gap-2">
            {sortedIssues.map((issue, i) => (
              <IssueCard key={i} issue={issue} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Positioning notes */}
      {result.positioning_notes && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-purple-600">
            Positioning vs. exemplars
          </h3>
          <p className="text-sm text-purple-900 leading-relaxed">{result.positioning_notes}</p>
        </div>
      )}

      {/* Suggested rewrite */}
      {result.suggested_rewrite && (
        <div>
          <button
            onClick={() => setShowRewrite((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-gray-50 transition"
          >
            <span className="text-sm font-semibold text-gray-700">
              Suggested rewrite
            </span>
            <span className="text-xs text-gray-400">{showRewrite ? "▲ hide" : "▼ show"}</span>
          </button>

          {showRewrite && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-200">
                {/* Original */}
                <div className="p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Your draft
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
                    {draftText}
                  </p>
                </div>
                {/* Rewrite */}
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                      AI rewrite
                    </p>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                    {result.suggested_rewrite}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exemplars used */}
      {result.exemplars_used.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Exemplars used
          </h3>
          <div className="flex flex-col gap-1.5">
            {result.exemplars_used.map((ex, i) => (
              <div key={ex.item_id} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="shrink-0 font-semibold text-gray-400">[{i + 1}]</span>
                <span className="font-medium text-gray-700">{ex.paper_title}</span>
                <span className="text-gray-400">— {ex.snippet}…</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
