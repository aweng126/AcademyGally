import type { ModuleType, ProcessingStatus } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  done: "bg-green-100 text-green-700",
  partial: "bg-orange-100 text-orange-700",
  pending: "bg-gray-100 text-gray-500",
  failed: "bg-red-100 text-red-600",
};

const LABELS: Record<ModuleType, string> = {
  arch_figure: "Arch",
  abstract: "Abstract",
  eval_figure: "Eval",
  algorithm: "Algo",
  other: "Other",
};

export default function ModuleChip({
  moduleType,
  status,
}: {
  moduleType: ModuleType;
  status: ProcessingStatus | "partial";
}) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {LABELS[moduleType]}
    </span>
  );
}
