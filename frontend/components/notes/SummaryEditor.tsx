"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuleSummary } from "@/lib/types";
import { getModuleSummary, updateModuleSummary } from "@/lib/api";

interface Props {
  moduleType: string;
  /** Note text to append to materials when user clicks "→ 素材" on a note */
  pendingMaterial: string | null;
  onPendingMaterialConsumed: () => void;
  /** Called whenever principles or materials change, for export */
  onContentChange?: (principles: string, materials: string) => void;
}

function AutosaveArea({
  label,
  description,
  value,
  onChange,
  onSave,
  saving,
  saved,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <span
          className={`text-xs transition-opacity duration-300 ${
            saving ? "text-gray-400 opacity-100" : saved ? "text-green-600 opacity-100" : "opacity-0"
          }`}
        >
          {saving ? "Saving..." : "Saved ✓"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        rows={6}
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300"
        placeholder={
          label === "Writing Principles"
            ? "e.g. Abstract 的 contribution 要量化，不能说'显著提升'..."
            : "e.g. 'We demonstrate a X% reduction in Y while maintaining Z.'"
        }
      />
    </div>
  );
}

export default function SummaryEditor({ moduleType, pendingMaterial, onPendingMaterialConsumed, onContentChange }: Props) {
  const [principles, setPrinciples] = useState("");
  const [materials, setMaterials] = useState("");
  const [savingP, setSavingP] = useState(false);
  const [savedP, setSavedP] = useState(false);
  const [savingM, setSavingM] = useState(false);
  const [savedM, setSavedM] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ref to track latest materials value for append without stale closure
  const materialsRef = useRef(materials);
  materialsRef.current = materials;

  useEffect(() => {
    setLoading(true);
    setPrinciples("");
    setMaterials("");
    getModuleSummary(moduleType)
      .then((s) => {
        setPrinciples(s.principles ?? "");
        setMaterials(s.materials ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [moduleType]);

  // Append pending material from parent
  useEffect(() => {
    if (!pendingMaterial) return;
    const appended =
      materialsRef.current.trim()
        ? `${materialsRef.current.trimEnd()}\n\n- ${pendingMaterial}`
        : `- ${pendingMaterial}`;
    setMaterials(appended);
    onPendingMaterialConsumed();
    // Trigger autosave immediately
    updateModuleSummary(moduleType, { materials: appended }).catch(console.error);
    setSavedM(true);
    setTimeout(() => setSavedM(false), 2000);
  }, [pendingMaterial, moduleType, onPendingMaterialConsumed]);

  // Notify parent of content changes for export
  useEffect(() => { onContentChange?.(principles, materials); }, [principles, materials]); // eslint-disable-line

  const handleSavePrinciples = async () => {
    setSavingP(true);
    try {
      await updateModuleSummary(moduleType, { principles });
      setSavedP(true);
      setTimeout(() => setSavedP(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingP(false);
    }
  };

  const handleSaveMaterials = async () => {
    setSavingM(true);
    try {
      await updateModuleSummary(moduleType, { materials });
      setSavedM(true);
      setTimeout(() => setSavedM(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingM(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400 p-4">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <AutosaveArea
        label="Writing Principles"
        description="跨论文归纳的写作方法论，指导自己的写作"
        value={principles}
        onChange={setPrinciples}
        onSave={handleSavePrinciples}
        saving={savingP}
        saved={savedP}
      />
      <div className="border-t border-gray-100" />
      <AutosaveArea
        label="Accumulated Materials"
        description="可直接复用的表达方式、模板片段和素材"
        value={materials}
        onChange={setMaterials}
        onSave={handleSaveMaterials}
        saving={savingM}
        saved={savedM}
      />
    </div>
  );
}
