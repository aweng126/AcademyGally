import type { ContentItem } from "@/lib/types";
import ArchFigurePanel from "./ArchFigurePanel";
import AbstractPanel from "./AbstractPanel";
import EvalFigurePanel from "./EvalFigurePanel";
import AlgorithmPanel from "./AlgorithmPanel";

export default function ModuleAnalysisPanel({ item }: { item: ContentItem }) {
  const titles: Record<string, string> = {
    arch_figure: "Architecture Figure",
    abstract: "Abstract",
    eval_figure: "Evaluation Figure",
    algorithm: "Algorithm",
  };

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-800">{titles[item.module_type]}</h2>
      {item.module_type === "arch_figure" && <ArchFigurePanel item={item} />}
      {item.module_type === "abstract" && <AbstractPanel item={item} />}
      {item.module_type === "eval_figure" && <EvalFigurePanel item={item} />}
      {item.module_type === "algorithm" && <AlgorithmPanel item={item} />}
    </section>
  );
}
