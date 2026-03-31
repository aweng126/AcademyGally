"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Paper } from "@/lib/types";
import { getPapers, uploadPaper } from "@/lib/api";
import PaperCard from "./PaperCard";

export default function LibraryView() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [year, setYear] = useState("");
  const [authors, setAuthors] = useState("");

  const loadPapers = useCallback(() => {
    setLoading(true);
    const params = q ? { q } : undefined;
    getPapers(params)
      .then(setPapers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [q]);

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setUploading(true);
    setUploadError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim());
    if (venue) form.append("venue", venue);
    if (year) form.append("year", year);
    if (authors) form.append("authors", authors);

    try {
      await uploadPaper(form);
      // Reset form
      setTitle(""); setVenue(""); setYear(""); setAuthors("");
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      loadPapers();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Upload toggle */}
      <div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {showForm ? "Cancel" : "+ Upload Paper"}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <form
          onSubmit={handleUpload}
          className="rounded-lg border bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-gray-800">New Paper</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Venue (e.g. OSDI, ATC)"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="number"
              placeholder="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <input
              type="text"
              placeholder="Authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="col-span-2 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <div className="col-span-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                required
                className="w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-gray-200"
              />
            </div>
          </div>
          {uploadError && (
            <p className="mt-2 text-xs text-red-600">{uploadError}</p>
          )}
          <button
            type="submit"
            disabled={uploading}
            className="mt-4 rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload PDF"}
          </button>
        </form>
      )}

      {/* Papers list */}
      {loading && papers.length === 0 && (
        <p className="text-sm text-gray-400">Loading...</p>
      )}

      <div className="flex flex-col gap-3">
        {papers.map((p) => (
          <PaperCard key={p.id} paper={p} />
        ))}
        {!loading && papers.length === 0 && (
          <p className="text-sm text-gray-400">
            {q ? `No results for "${q}"` : "No papers yet. Upload a PDF to get started."}
          </p>
        )}
      </div>
    </div>
  );
}
