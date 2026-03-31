import Link from "next/link";
import type { TopicPaper, ModuleType } from "@/lib/types";
import ProgressBar from "@/components/shared/ProgressBar";

const MODULE_LABELS: Record<string, string> = {
  abstract: "Abstract",
  arch_figure: "Arch",
  eval_figure: "Eval",
  algorithm: "Algo",
};

interface Props {
  tp: TopicPaper;
  visibleModules?: ModuleType[];
  onToggle?: (paperId: string, module: string, done: boolean) => void;
}

export default function PaperProgressRow({ tp, visibleModules, onToggle }: Props) {
  const allModules = Object.entries(tp.progress_json) as [string, boolean][];
  const visible = visibleModules
    ? allModules.filter(([mod]) => visibleModules.includes(mod as ModuleType))
    : allModules;

  const done = allModules.filter(([, v]) => v).length;
  const pct = allModules.length ? (done / allModules.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/papers/${tp.paper_id}`}
          className="font-medium text-gray-800 hover:underline"
        >
          {tp.paper?.title ?? tp.paper_id}
        </Link>
        <span className="text-xs text-gray-400">
          {done}/{allModules.length} modules
        </span>
      </div>
      <ProgressBar value={pct} />
      <div className="flex flex-wrap gap-2">
        {visible.map(([mod, isDone]) => (
          <label
            key={mod}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${
              isDone ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            <input
              type="checkbox"
              checked={isDone}
              onChange={(e) => onToggle?.(tp.paper_id, mod, e.target.checked)}
              className="h-3 w-3 rounded"
            />
            {MODULE_LABELS[mod] ?? mod}
          </label>
        ))}
      </div>
    </div>
  );
}
