"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const handleSearch = () => {
    const view = searchParams.get("view") ?? "library";
    if (value.trim()) {
      router.push(`/?view=${view}&q=${encodeURIComponent(value.trim())}`);
    } else {
      router.push(`/?view=${view}`);
    }
  };

  return (
    <div className="flex gap-1">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        placeholder="Search papers, figures..."
        className="w-60 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      <button
        onClick={handleSearch}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Search
      </button>
    </div>
  );
}
