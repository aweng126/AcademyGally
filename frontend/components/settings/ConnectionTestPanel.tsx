"use client";

import type { TestResult } from "@/lib/types";

interface Props {
  result: TestResult | null;
  testing: boolean;
}

export default function ConnectionTestPanel({ result, testing }: Props) {
  if (testing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-600">Testing connection…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.status === "ok") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-semibold text-sm">✓ Connection successful</span>
          {result.latency_ms != null && (
            <span className="text-xs text-green-500">{result.latency_ms} ms</span>
          )}
        </div>
        {result.model && (
          <p className="text-xs text-green-600 mt-1">
            Model: {result.model} · Provider: {result.provider}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm font-semibold text-red-600">✗ Connection failed</p>
      {result.error && <p className="text-xs text-red-500 mt-1">{result.error}</p>}
    </div>
  );
}
