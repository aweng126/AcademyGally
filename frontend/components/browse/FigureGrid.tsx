import type { ContentItem } from "@/lib/types";
import FigureCard from "./FigureCard";

export default function FigureGrid({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <FigureCard key={item.id} item={item} />
      ))}
    </div>
  );
}
