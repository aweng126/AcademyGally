import type { TopicPaper, ModuleType } from "@/lib/types";
import ProgressBar from "@/components/shared/ProgressBar";

const MODULE_LABELS: Record<ModuleType, string> = {
  abstract: "Abstract",
  arch_figure: "Arch",
  eval_figure: "Eval",
  algorithm: "Algo",
};

export default function PaperProgressRow({ tp }: { tp: TopicPaper }) {
  const modules = Object.entries(tp.progress_json) as [ModuleType, boolean][];
  const done = modules.filter(([, v]) => v).length;
  const pct = modules.length ? (done / modules.length) * 100 : 0;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{tp.paper?.title ?? tp.paper_id}</span>
        <span className="text-xs text-gray-400">
          {done}/{modules.length}
        </span>
      </div>
      <ProgressBar value={pct} />
      <div className="flex gap-2">
        {modules.map(([mod, done]) => (
          <span
            key={mod}
            className={`rounded px-1.5 py-0.5 text-xs ${
              done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
            }`}
          >
            {MODULE_LABELS[mod]}
          </span>
        ))}
      </div>
    </div>
  );
}
