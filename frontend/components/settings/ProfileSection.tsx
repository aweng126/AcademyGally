"use client";

import { useEffect, useState } from "react";
import { getProfile, updateProfile } from "@/lib/api";
import type { UserProfile } from "@/lib/types";

const RESEARCH_AREAS = [
  { value: "systems", label: "Systems" },
  { value: "ml", label: "ML" },
  { value: "nlp", label: "NLP" },
  { value: "security", label: "Security" },
  { value: "hci", label: "HCI" },
  { value: "other", label: "Other" },
];

const ACADEMIC_STAGES = [
  { value: "phd_y1", label: "PhD Y1" },
  { value: "phd_y2", label: "PhD Y2" },
  { value: "phd_y3", label: "PhD Y3" },
  { value: "phd_y4", label: "PhD Y4" },
  { value: "phd_y5", label: "PhD Y5" },
  { value: "phd_y6", label: "PhD Y6" },
  { value: "postdoc", label: "Postdoc" },
  { value: "faculty", label: "Faculty" },
  { value: "other", label: "Other" },
];

export default function ProfileSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchArea, setResearchArea] = useState("");
  const [academicStage, setAcademicStage] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setDisplayName(p.display_name ?? "");
      setInstitution(p.institution ?? "");
      setResearchArea(p.research_area ?? "");
      setAcademicStage(p.academic_stage ?? "");
      setInterests(p.research_interests ?? []);
    });
  }, []);

  const handleInterestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && interestInput.trim()) {
      e.preventDefault();
      const val = interestInput.trim();
      if (!interests.includes(val)) setInterests((prev) => [...prev, val]);
      setInterestInput("");
    }
  };

  const removeInterest = (tag: string) => {
    setInterests((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        display_name: displayName || null,
        institution: institution || null,
        research_area: researchArea || null,
        research_interests: interests,
        academic_stage: academicStage || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-5">Profile</h2>
      <div className="flex flex-col gap-4 max-w-lg">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Your name"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Institution</span>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="University or lab"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Research area</span>
          <select
            value={researchArea}
            onChange={(e) => setResearchArea(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— Select —</option>
            {RESEARCH_AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Research interests</span>
          <div className="flex flex-wrap gap-1 mb-1">
            {interests.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {tag}
                <button onClick={() => removeInterest(tag)} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={handleInterestKeyDown}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Type and press Enter to add"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Academic stage</span>
          <select
            value={academicStage}
            onChange={(e) => setAcademicStage(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">— Select —</option>
            {ACADEMIC_STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

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
