"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "library", label: "Library" },
  { key: "topic", label: "Topic study" },
  { key: "browse", label: "Browse by module" },
] as const;

type ViewKey = (typeof TABS)[number]["key"];

export default function NavTabs({ active }: { active: ViewKey }) {
  const pathname = usePathname();
  const isWritingCoach = pathname === "/writing-coach";
  const isNotes = pathname === "/notes";

  return (
    <nav className="flex gap-1">
      {TABS.map(({ key, label }) => (
        <Link
          key={key}
          href={`/?view=${key}`}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            active === key && !isWritingCoach && !isNotes
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {label}
        </Link>
      ))}
      <Link
        href="/writing-coach"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          isWritingCoach
            ? "bg-blue-600 text-white"
            : "text-blue-600 hover:bg-blue-50"
        }`}
      >
        Writing Coach
      </Link>
      <Link
        href="/notes"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          isNotes
            ? "bg-gray-900 text-white"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        Notes
      </Link>
    </nav>
  );
}
