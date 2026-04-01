"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import type { Paper } from "@/lib/types";
import { getPapers, uploadPaper } from "@/lib/api";
import PaperCard from "./PaperCard";

export default function LibraryView() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const router = useRouter();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);

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
        <form onSubmit={handleUpload} className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4">
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
      )}

      {/* Papers list */}
      {loading && papers.length === 0 && (
        <p className="text-sm text-gray-400">Loading...</p>
      )}

      <div className="flex flex-col gap-3">
        {papers.map((p) => (
          <PaperCard
            key={p.id}
            paper={p}
            onDelete={(id) => setPapers((prev) => prev.filter((x) => x.id !== id))}
          />
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
