import type { ProcessingStatus } from "@/lib/types";

const STYLES: Record<ProcessingStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  done: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  awaiting_metadata: "bg-blue-100 text-blue-700",
};

export default function StatusBadge({ status }: { status: ProcessingStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
