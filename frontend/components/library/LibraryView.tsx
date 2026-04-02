"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import type { Paper } from "@/lib/types";
import { getPapers, uploadPaper } from "@/lib/api";
import PaperCard from "./PaperCard";
import VenueFilter from "./VenueFilter";

export default function LibraryView() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const router = useRouter();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "year">("newest");
  const loadPapers = useCallback(() => {
    setLoading(true);
    const params: { q?: string; venue?: string; year?: number } = {};
    if (q) params.q = q;
    if (selectedVenue) params.venue = selectedVenue;
    if (selectedYear) params.year = selectedYear;
    getPapers(Object.keys(params).length ? params : undefined)
      .then(setPapers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q, selectedVenue, selectedYear]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Poll while any paper is processing
  useEffect(() => {
    const processing = papers.some(
      (p) => p.processing_status === "pending" || p.processing_status === "processing"
    );
    if (!processing) return;
    const t = setTimeout(loadPapers, 3000);
    return () => clearTimeout(t);
  }, [papers, loadPapers]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      const paper = await uploadPaper(form);
      router.push(`/papers/${paper.id}/metadata`);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Upload toggle */}
      <div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showUpload ? "Cancel" : "+ Upload Paper"}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-4">
          <form onSubmit={handleUpload} className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf"
              required
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="flex-1 text-sm text-gray-600"
            />
            <button
              type="submit"
              disabled={uploading || !uploadFile}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <button type="button" onClick={() => setShowUpload(false)} className="text-sm text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </form>


        </div>
      )}

      {/* Venue filter */}
      <VenueFilter
        selectedVenue={selectedVenue}
        selectedYear={selectedYear}
        onSelect={(venue, year) => {
          setSelectedVenue(venue);
          setSelectedYear(year);
        }}
      />

      {/* Sort controls */}
      {papers.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sort by</span>
          {(["newest", "oldest", "title", "year"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`rounded px-2 py-0.5 capitalize transition ${sortBy === opt ? "bg-gray-200 font-medium text-gray-800" : "hover:bg-gray-100"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Papers list */}
      {loading && papers.length === 0 && (
        <p className="text-sm text-gray-400">Loading...</p>
      )}

      <div className="flex flex-col gap-3">
        {[...papers].sort((a, b) => {
          if (sortBy === "oldest") return new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
          if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
          if (sortBy === "year") return (b.year ?? 0) - (a.year ?? 0);
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        }).map((p) => (
          <PaperCard
            key={p.id}
            paper={p}
            onDelete={(id) => setPapers((prev) => prev.filter((x) => x.id !== id))}
            onRetry={(updated) => setPapers((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
          />
        ))}
        {!loading && papers.length === 0 && !q && (
          <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
            <div className="text-5xl">📄</div>
            <div>
              <p className="text-lg font-semibold text-gray-700">Upload your first paper</p>
              <p className="mt-1 text-sm text-gray-500">Upload a PDF to start extracting architecture figures, abstracts, and more.</p>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Upload Paper
            </button>
          </div>
        )}
        {!loading && papers.length === 0 && q && (
          <p className="text-sm text-gray-400">No results for &ldquo;{q}&rdquo;</p>
        )}
      </div>
    </div>
  );
}
