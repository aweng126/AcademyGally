import Link from "next/link";
import type { ContentItem } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function FigureCard({ item }: { item: ContentItem }) {
  return (
    <Link
      href={`/papers/${item.paper_id}`}
      className="flex flex-col gap-2 rounded-lg border bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      {item.image_path ? (
        <img
          src={`${API_URL}/figures/${item.image_path}`}
          alt={item.caption ?? "figure"}
          className="aspect-video w-full rounded object-contain bg-gray-50"
        />
      ) : (
        <div className="aspect-video w-full rounded bg-gray-100" />
      )}
      {item.caption && (
        <p className="line-clamp-2 text-xs text-gray-600">{item.caption}</p>
      )}
    </Link>
  );
}
