"use client";

import type { ProviderPreset, ModelConfigOut } from "@/lib/types";

const PRESET_ICONS: Record<string, string> = {
  anthropic: "🤖",
  glm: "🧠",
  openai: "⚡",
  deepseek: "🔍",
  ollama: "🦙",
  custom: "⚙",
};

interface Props {
  preset: ProviderPreset;
  currentConfig: ModelConfigOut | null;
  onSelect: (preset: ProviderPreset) => void;
}

export default function ProviderPresetCard({ preset, currentConfig, onSelect }: Props) {
  const isActive = currentConfig?.preset === preset.id;
  const isConfigured =
    preset.id === "anthropic"
      ? !!currentConfig?.anthropic_api_key_hint
      : !!currentConfig?.vlm_api_key_hint && currentConfig?.preset === preset.id;

  return (
    <button
      onClick={() => onSelect(preset)}
      className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition hover:shadow-sm ${
        isActive
          ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{PRESET_ICONS[preset.id] ?? "🔧"}</span>
        <span className="text-sm font-medium text-gray-800">{preset.label}</span>
      </div>
      <span
        className={`self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${
          isActive
            ? "bg-blue-100 text-blue-700"
            : isConfigured
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {isActive ? "Active" : isConfigured ? "Configured" : "Not configured"}
      </span>
    </button>
  );
}
