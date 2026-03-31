import type { ContentItem, AlgorithmAnalysis } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AlgorithmPanel({ item }: { item: ContentItem }) {
  const a = item.analysis_json as AlgorithmAnalysis | null;

  return (
    <div className="flex flex-col gap-4">
      {item.image_path && (
        <a
          href={`${API_URL}/figures/${item.image_path}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={`${API_URL}/figures/${item.image_path}`}
            alt="algorithm"
            className="max-h-72 w-full cursor-zoom-in rounded-lg border object-contain bg-gray-50 transition hover:opacity-90"
          />
        </a>
      )}

      {a ? (
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-gray-800">{a.algorithm_name}</h3>
            <p className="mt-1 text-gray-600">{a.purpose}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <section>
              <h3 className="font-semibold text-gray-800">Inputs</h3>
              <ul className="mt-1 list-disc pl-4 text-gray-600">
                {a.inputs.map((inp, i) => <li key={i}>{inp}</li>)}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-gray-800">Outputs</h3>
              <ul className="mt-1 list-disc pl-4 text-gray-600">
                {a.outputs.map((out, i) => <li key={i}>{out}</li>)}
              </ul>
            </section>
          </div>

          <section>
            <h3 className="font-semibold text-gray-800">Key steps</h3>
            <ol className="mt-1 list-decimal pl-4 text-gray-600 space-y-0.5">
              {a.key_steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </section>

          {a.complexity && (
            <p className="text-gray-600">
              <span className="font-semibold text-gray-800">Complexity: </span>
              {a.complexity}
            </p>
          )}

          {a.novelty && (
            <section>
              <h3 className="font-semibold text-gray-800">Novelty</h3>
              <p className="mt-1 text-gray-600">{a.novelty}</p>
            </section>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          {item.processing_status === "processing"
            ? "AI analysis in progress..."
            : item.processing_status === "pending"
            ? "Awaiting classification."
            : "Analysis failed."}
        </p>
      )}
    </div>
  );
}
