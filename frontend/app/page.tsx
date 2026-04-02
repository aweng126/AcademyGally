"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NavTabs from "@/components/layout/NavTabs";
import SearchBar from "@/components/layout/SearchBar";
import LibraryView from "@/components/library/LibraryView";
import TopicStudyView from "@/components/topic/TopicStudyView";
import BrowseByModuleView from "@/components/browse/BrowseByModuleView";

type ViewType = "library" | "topic" | "browse";

function GalleryContent() {
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") ?? "library") as ViewType;

  return (
    <main className="min-h-screen">
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">AcademyGally</h1>
          <Link
            href="/settings"
            className="text-gray-400 hover:text-gray-700 text-lg"
            title="Settings"
          >
            ⚙
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <NavTabs active={view} />
          <SearchBar />
        </div>
      </header>
      <section className="p-6">
        {view === "library" && <LibraryView />}
        {view === "topic" && <TopicStudyView />}
        {view === "browse" && <BrowseByModuleView />}
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <GalleryContent />
    </Suspense>
  );
}
