"use client";

export type StudyFocus =
  | "all"
  | "abstract"
  | "introduction"
  | "background"
  | "design"
  | "implementation"
  | "evaluation"
  | "discussion"
  | "conclusion";

// Which module_type each section maps to. null = not yet extracted.
export const SECTION_MODULE_MAP: Record<StudyFocus, string | null> = {
  all:            null,
  abstract:       "abstract",
  introduction:   null,
  background:     null,
  design:         "arch_figure",
  implementation: "algorithm",
  evaluation:     "eval_figure",
  discussion:     null,
  conclusion:     null,
};

export const SECTION_LABELS: Record<StudyFocus, string> = {
  all:            "All",
  abstract:       "Abstract",
  introduction:   "Introduction",
  background:     "Background",
  design:         "Design",
  implementation: "Implementation",
  evaluation:     "Evaluation",
  discussion:     "Discussion",
  conclusion:     "Conclusion",
};

// Ordered list for the reading flow selector
export const SECTION_ORDER: StudyFocus[] = [
  "all",
  "abstract",
  "introduction",
  "background",
  "design",
  "implementation",
  "evaluation",
  "discussion",
  "conclusion",
];

const STORAGE_KEY = "academy_study_focus";

export function getStoredFocus(): StudyFocus {
  if (typeof window === "undefined") return "all";
  const stored = localStorage.getItem(STORAGE_KEY);
  // Handle legacy values from previous version
  if (stored === "arch_figure") return "design";
  if (stored === "eval_figure") return "evaluation";
  return (stored as StudyFocus) ?? "all";
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
    <div className="flex flex-wrap gap-1.5">
      {SECTION_ORDER.map((section) => {
        const isAvailable = section === "all" || SECTION_MODULE_MAP[section] !== null;
        const isActive = value === section;

        return (
          <button
            key={section}
            onClick={() => handleChange(section)}
            title={!isAvailable ? "Not yet extracted — coming in Phase 2" : undefined}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              isActive
                ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                : isAvailable
                ? "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                : "border-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            {SECTION_LABELS[section]}
            {!isAvailable && <span className="ml-1 text-[10px]">🔒</span>}
          </button>
        );
      })}
    </div>
  );
}
