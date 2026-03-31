import type { ContentItem } from "@/lib/types";
import FigureCard from "./FigureCard";

export default function FigureGrid({ items }: { items: ContentItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-400">
        No content available for this module yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <FigureCard key={item.id} item={item} />
      ))}
    </div>
  );
}
