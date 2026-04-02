"use client";

import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/api";

export default function AppPreferencesSection() {
  const [defaultView, setDefaultView] = useState<"library" | "topic" | "browse">("library");
  const [analysisLanguage, setAnalysisLanguage] = useState<"english" | "chinese" | "auto">("english");
  const [autoRetry, setAutoRetry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getProfile().then((p) => {
      setDefaultView(p.default_view);
      setAnalysisLanguage(p.analysis_language);
      setAutoRetry(p.auto_retry);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ default_view: defaultView, analysis_language: analysisLanguage, auto_retry: autoRetry });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Preferences</h2>
      <div className="flex flex-col gap-5 max-w-lg">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">Default view</span>
          <div className="flex gap-3">
            {(["library", "topic", "browse"] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="defaultView"
                  value={v}
                  checked={defaultView === v}
                  onChange={() => setDefaultView(v)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">
                  {v === "browse" ? "Browse" : v === "topic" ? "Topic Study" : "Library"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Analysis language</span>
          <select
            value={analysisLanguage}
            onChange={(e) => setAnalysisLanguage(e.target.value as "english" | "chinese" | "auto")}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-xs"
          >
            <option value="english">English</option>
            <option value="chinese">中文</option>
            <option value="auto">Follow paper language</option>
          </select>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setAutoRetry((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${autoRetry ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRetry ? "translate-x-5" : ""}`} />
          </div>
          <span className="text-sm text-gray-700">Auto-retry failed analyses</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
