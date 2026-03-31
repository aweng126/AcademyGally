"use client";

export default function SearchBar() {
  return (
    <input
      type="search"
      placeholder="Search papers, figures..."
      className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
    />
  );
}
