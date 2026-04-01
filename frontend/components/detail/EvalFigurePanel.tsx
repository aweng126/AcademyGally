"use client";

import { useState } from "react";
import type { ContentItem, EvalFigureAnalysis } from "@/lib/types";
import { retryAnalysis } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function RetryButton({ itemId, onRetry }: { itemId: string; onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      await retryAnalysis(itemId);
      onRetry();
    } catch {
      setError("Retry failed. Please try again.");
      setRetrying(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="self-start rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {retrying ? "Retrying..." : "Retry Analysis"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

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
        <div className="flex flex-1 flex-col gap-4 text-sm">
          {/* Headline result — green hero card */}
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-base font-semibold text-green-900">
            {a.headline_result}
          </div>

          {/* Workload */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Workload</p>
            <p className="text-gray-700 text-sm">{a.workload_desc}</p>
          </section>

          {/* Metrics — label above chips */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Metrics</p>
            <div className="flex flex-wrap gap-1.5">
              {a.metrics.map((m) => (
                <span key={m} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {m}
                </span>
              ))}
            </div>
          </section>

          {/* Baselines — label above chips */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Baselines</p>
            <div className="flex flex-wrap gap-1.5">
              {a.baselines.map((b) => (
                <span key={b} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  {b}
                </span>
              ))}
            </div>
          </section>

          {/* Caveats — amber warning cards */}
          {a.caveats.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Caveats</p>
              <div className="flex flex-col gap-1.5">
                {a.caveats.map((c, i) => (
                  <div
                    key={i}
                    className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 rounded text-sm text-amber-900"
                  >
                    {c}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-400">
            {item.processing_status === "failed" ? (
              <span className="text-red-500">Analysis failed — please retry or check the figure.</span>
            ) : (
              "Analysis pending."
            )}
          </p>
          {item.processing_status === "failed" && (
            <RetryButton itemId={item.id} onRetry={() => window.location.reload()} />
          )}
        </div>
      )}
    </div>
  );
}
