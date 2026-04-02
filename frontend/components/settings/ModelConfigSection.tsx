"use client";

import { useEffect, useState } from "react";
import { getModelConfig, updateModelConfig, testModelConnection, getModelPresets } from "@/lib/api";
import type { ModelConfigOut, ModelConfigIn, ProviderPreset, TestResult } from "@/lib/types";
import ProviderPresetCard from "./ProviderPresetCard";
import ConnectionTestPanel from "./ConnectionTestPanel";

function ConfigStatusBar({ config }: { config: ModelConfigOut }) {
  if (config.config_source === "database" && config.effective_model) {
    const preset = config.preset ?? config.effective_provider;
    const testedAt = config.last_tested_at
      ? new Date(config.last_tested_at).toLocaleString()
      : null;
    const statusColor =
      config.last_test_status === "ok"
        ? "text-green-600"
        : config.last_test_status === "failed"
        ? "text-red-600"
        : "text-gray-500";
    return (
      <div className={`flex items-center gap-2 text-xs ${statusColor}`}>
        <span>{config.last_test_status === "ok" ? "🟢" : config.last_test_status === "failed" ? "🔴" : "⚪"}</span>
        <span>Using DB config — {preset} ({config.effective_model})</span>
        {testedAt && <span className="text-gray-400">· Last tested: {testedAt}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-yellow-600">
      <span>⚠️</span>
      <span>No DB config — Falling back to environment variables ({config.effective_provider} / {config.effective_model})</span>
    </div>
  );
}

export default function ModelConfigSection() {
  const [config, setConfig] = useState<ModelConfigOut | null>(null);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [visionModel, setVisionModel] = useState("");
  const [textModel, setTextModel] = useState("");
  const [sameModel, setSameModel] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getModelConfig(), getModelPresets()]).then(([cfg, prs]) => {
      setConfig(cfg);
      setPresets(prs);
      if (cfg.preset) {
        const p = prs.find((pr) => pr.id === cfg.preset) ?? null;
        setSelectedPreset(p);
      }
      setBaseUrl(cfg.vlm_base_url ?? "");
      setVisionModel(cfg.vlm_model ?? "");
      const hasSeparateText = !!cfg.vlm_text_model && cfg.vlm_text_model !== cfg.vlm_model;
      setSameModel(!hasSeparateText);
      setTextModel(cfg.vlm_text_model ?? "");
    });
  }, []);

  const handlePresetSelect = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    if (preset.base_url) setBaseUrl(preset.base_url);
    if (preset.vision_models.length > 0) setVisionModel(preset.vision_models[0]);
    if (preset.text_models.length > 0) setTextModel(preset.text_models[0]);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: ModelConfigIn = {
        preset: selectedPreset?.id,
        provider: selectedPreset?.provider,
        vlm_base_url: baseUrl || undefined,
        vlm_model: visionModel || undefined,
        vlm_text_model: sameModel ? null : (textModel || null),
      };
      if (apiKeyEditing && apiKey) {
        if (selectedPreset?.provider === "anthropic") {
          body.anthropic_api_key = apiKey;
        } else {
          body.vlm_api_key = apiKey;
        }
      }
      const updated = await updateModelConfig(body);
      setConfig(updated);
      setApiKey("");
      setApiKeyEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testModelConnection();
      setTestResult(result);
      const updated = await getModelConfig();
      setConfig(updated);
    } finally {
      setTesting(false);
    }
  };

  if (!config) return <div className="text-sm text-gray-400">Loading…</div>;

  const isAnthropic = selectedPreset?.provider === "anthropic";
  const keyHint = isAnthropic ? config.anthropic_api_key_hint : config.vlm_api_key_hint;
  const currentPresetModels = selectedPreset ?? { vision_models: [] as string[], text_models: [] as string[] };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <ConfigStatusBar config={config} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Provider</h2>
        <div className="grid grid-cols-3 gap-3">
          {presets.map((p) => (
            <ProviderPresetCard
              key={p.id}
              preset={p}
              currentConfig={config}
              onSelect={handlePresetSelect}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Configuration</h2>
        <div className="flex flex-col gap-4 max-w-lg">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              {isAnthropic ? "Anthropic API Key" : "API Key"}
            </span>
            {apiKeyEditing ? (
              <div className="flex gap-2">
                <input
                  type={apiKeyRevealed ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Paste new key…"
                />
                <button
                  onClick={() => setApiKeyRevealed((v) => !v)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2"
                >
                  {apiKeyRevealed ? "👁‍🗨" : "👁"}
                </button>
                <button
                  onClick={() => { setApiKeyEditing(false); setApiKey(""); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-gray-600 bg-gray-50 rounded border border-gray-200 px-3 py-2 flex-1">
                  {keyHint ?? <span className="text-gray-400 italic">Not set</span>}
                </span>
                <button
                  onClick={() => setApiKeyEditing(true)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  ✏ Edit
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400">
              {config.config_source === "database"
                ? "From database"
                : "From environment variable — DB config will take priority if set"}
            </p>
          </div>

          {!isAnthropic && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">Base URL</span>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="https://api.example.com/v1"
              />
            </label>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              Vision model
              <span className="ml-1 text-xs text-gray-400">(arch &amp; eval figure analysis)</span>
            </span>
            {currentPresetModels.vision_models.length > 0 ? (
              <select
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {currentPresetModels.vision_models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="model-name"
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sameModel}
                onChange={(e) => setSameModel(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-700">
                Use same model for text analysis
                <span className="ml-1 text-xs text-gray-400">(abstract analysis &amp; Writing Coach)</span>
              </span>
            </label>
            {!sameModel && (
              currentPresetModels.text_models.length > 0 ? (
                <select
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {currentPresetModels.text_models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="text-model-name"
                />
              )
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || saving}
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ▶ Test Connection
            </button>
          </div>

          <ConnectionTestPanel result={testResult} testing={testing} />
        </div>
      </div>
    </div>
  );
}
