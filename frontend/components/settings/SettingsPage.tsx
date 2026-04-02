"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProfileSection from "./ProfileSection";
import ModelConfigSection from "./ModelConfigSection";
import AppPreferencesSection from "./AppPreferencesSection";

type Section = "profile" | "model" | "preferences";

const NAV_ITEMS: { key: Section; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "model", label: "Model Config" },
  { key: "preferences", label: "Preferences" },
];

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("profile");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Section;
    if (["profile", "model", "preferences"].includes(hash)) {
      setActive(hash);
    }
    const onHash = () => {
      const h = window.location.hash.replace("#", "") as Section;
      if (["profile", "model", "preferences"].includes(h)) setActive(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 flex gap-8">
        <nav className="w-32 flex-shrink-0">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ key, label }) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={() => setActive(key)}
                  className={`block rounded px-3 py-2 text-sm font-medium transition ${
                    active === key
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 min-w-0">
          {active === "profile" && <ProfileSection />}
          {active === "model" && <ModelConfigSection />}
          {active === "preferences" && <AppPreferencesSection />}
        </main>
      </div>
    </div>
  );
}
