import Link from "next/link";
import type { ContentItem } from "@/lib/types";

export default function FigureCard({ item }: { item: ContentItem }) {
  return (
    <Link
      href={`/content/${item.id}`}
      className="flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      {item.image_path && (
        <img
          src={`http://localhost:8000/figures/${item.image_path}`}
          alt={item.caption ?? "figure"}
          className="aspect-video w-full rounded object-cover"
        />
      )}
      {item.caption && (
        <p className="line-clamp-2 text-xs text-gray-600">{item.caption}</p>
      )}
    </Link>
  );
}
