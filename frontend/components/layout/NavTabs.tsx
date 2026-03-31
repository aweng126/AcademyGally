"use client";

import Link from "next/link";

const TABS = [
  { key: "library", label: "Library" },
  { key: "topic", label: "Topic study" },
  { key: "browse", label: "Browse by module" },
] as const;

type ViewKey = (typeof TABS)[number]["key"];

export default function NavTabs({ active }: { active: ViewKey }) {
  return (
    <nav className="flex gap-1">
      {TABS.map(({ key, label }) => (
        <Link
          key={key}
          href={`/?view=${key}`}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            active === key
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
