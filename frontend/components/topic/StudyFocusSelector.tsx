"use client";

export type StudyFocus = "all" | "abstract" | "arch_figure" | "eval_figure";

const OPTIONS: { value: StudyFocus; label: string }[] = [
  { value: "all", label: "All modules" },
  { value: "abstract", label: "Abstract only" },
  { value: "arch_figure", label: "Arch figures only" },
  { value: "eval_figure", label: "Eval figures only" },
];

const STORAGE_KEY = "academy_study_focus";

export function getStoredFocus(): StudyFocus {
  if (typeof window === "undefined") return "all";
  return (localStorage.getItem(STORAGE_KEY) as StudyFocus) ?? "all";
}

export default function StudyFocusSelector({
  value,
  onChange,
}: {
  value: StudyFocus;
  onChange: (v: StudyFocus) => void;
}) {
  const handleChange = (v: StudyFocus) => {
    localStorage.setItem(STORAGE_KEY, v);
    onChange(v);
  };

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            value === opt.value
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
