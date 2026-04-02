"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { CoachResponse } from "@/lib/types";
import { getWritingFeedback } from "@/lib/api";
import ExemplarPicker from "./ExemplarPicker";
import FeedbackDisplay from "./FeedbackDisplay";

const MODES = [
  { value: "abstract", label: "Abstract" },
  { value: "intro_paragraph", label: "Introduction §" },
  { value: "related_work_paragraph", label: "Related Work §" },
] as const;

type Mode = (typeof MODES)[number]["value"];

interface CoachSession {
  id: string;
  timestamp: number;
  mode: Mode;
  draftText: string;
  result: CoachResponse;
}

const HISTORY_KEY = "academy_coach_history";
const MAX_HISTORY = 10;

function loadHistory(): CoachSession[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSession(session: CoachSession) {
  const history = loadHistory();
  const updated = [session, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const MODE_LABEL: Record<Mode, string> = {
  abstract: "Abstract",
  intro_paragraph: "Introduction §",
  related_work_paragraph: "Related Work §",
};

export default function WritingCoachPage({
  initialExemplarId,
}: {
  initialExemplarId?: string;
}) {
  const [mode, setMode] = useState<Mode>("abstract");
  const [draftText, setDraftText] = useState("");
  const [exemplarIds, setExemplarIds] = useState<string[]>(
    initialExemplarId ? [initialExemplarId] : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResponse | null>(null);

  const [history, setHistory] = useState<CoachSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draftText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getWritingFeedback({
        draft_text: draftText,
        mode,
        exemplar_item_ids: exemplarIds.length > 0 ? exemplarIds : undefined,
      });
      setResult(res);
      const session: CoachSession = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        mode,
        draftText,
        result: res,
      };
      saveSession(session);
      setHistory(loadHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function loadSession(session: CoachSession) {
    setMode(session.mode);
    setDraftText(session.draftText);
    setResult(session.result);
    setShowHistory(false);
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/" className="mb-2 block text-sm text-gray-500 hover:text-gray-800">
            ← Library
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Writing Coach</h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste your draft text and get AI feedback based on exemplar papers from your library.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="relative rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            History
            <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600">
              {history.length}
            </span>
          </button>
        )}
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recent sessions
            </p>
            <button
              onClick={clearHistory}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-col divide-y">
            {history.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s)}
                className="flex items-start gap-3 py-2.5 text-left hover:bg-gray-50 transition px-2 rounded"
              >
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-1 text-sm text-gray-700">{s.draftText.slice(0, 80)}…</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">{MODE_LABEL[s.mode]}</span>
                    <span>{formatTime(s.timestamp)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold text-gray-500">
                  {s.result.overall_score}<span className="text-xs font-normal text-gray-300">/5</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Input panel */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Mode selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Passage type
              </label>
              <div className="flex gap-2">
                {MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      mode === value
                        ? "bg-gray-900 text-white"
                        : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Draft text area */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Your draft
              </label>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={
                  mode === "abstract"
                    ? "Paste your abstract draft here…"
                    : mode === "intro_paragraph"
                    ? "Paste your introduction paragraph here…"
                    : "Paste your related work paragraph here…"
                }
                rows={12}
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {draftText.length} chars
              </p>
            </div>

            {/* Exemplar picker */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Reference papers{" "}
                <span className="font-normal normal-case text-gray-400">(up to 5)</span>
              </label>
              <ExemplarPicker
                selected={exemplarIds}
                onChange={setExemplarIds}
              />
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !draftText.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Analyzing…
                </span>
              ) : (
                "Get Feedback"
              )}
            </button>
          </form>
        </div>

        {/* Right: Feedback display */}
        <div className="lg:col-span-3">
          {result ? (
            <FeedbackDisplay result={result} draftText={draftText} />
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              {loading ? (
                <>
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  <p className="mt-3 text-sm text-gray-500">AI is reading your draft…</p>
                  <p className="text-xs text-gray-400">Usually takes 10–20 seconds</p>
                </>
              ) : (
                <>
                  <div className="mb-3 text-4xl">✍️</div>
                  <p className="text-sm font-medium text-gray-600">Feedback will appear here</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Paste your draft and optionally select reference papers, then click "Get Feedback"
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
