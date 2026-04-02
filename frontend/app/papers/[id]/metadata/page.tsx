"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPaperMetadata, confirmPaperMetadata, deletePaper } from "@/lib/api";
import type { VlmMetadataResult, ScholarSuggestion } from "@/lib/types";

interface Props {
  params: { id: string };
}

export default function MetadataPage({ params }: Props) {
  const router = useRouter();
  const { id } = params;

  const [status, setStatus] = useState<"extracting" | "ready">("extracting");
  const [progress, setProgress] = useState(0);
  const [scholar, setScholar] = useState<ScholarSuggestion | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [venue, setVenue] = useState("");
  const [institution, setInstitution] = useState("");
  const [doi, setDoi] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate progress bar non-linearly toward ~90% while extracting
  useEffect(() => {
    if (status !== "extracting") {
      setProgress(100);
      return;
    }
    progressRef.current = setInterval(() => {
      setProgress((p) => p + (90 - p) * 0.07);
    }, 800);
    return () => clearInterval(progressRef.current!);
  }, [status]);

  function applyVlm(v: VlmMetadataResult) {
    setTitle(v.title ?? "");
    setAuthors(v.authors?.join(", ") ?? "");
    setYear(v.year?.toString() ?? "");
    setVenue(v.venue ?? "");
    setInstitution(v.institution ?? "");
  }

  useEffect(() => {
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 2;
      try {
        const data = await getPaperMetadata(id);
        if (data.status !== "extracting") {
          clearInterval(pollRef.current!);
          setStatus("ready");
          if (data.vlm_result) applyVlm(data.vlm_result);
          if (data.scholar_suggestion) {
            setScholar(data.scholar_suggestion);
            if (data.scholar_suggestion.doi) setDoi(data.scholar_suggestion.doi);
          }
        } else if (elapsed >= 30) {
          clearInterval(pollRef.current!);
          setStatus("ready");
        }
      } catch {
        clearInterval(pollRef.current!);
        setStatus("ready");
      }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [id]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await confirmPaperMetadata(id, {
        title,
        authors: authors || undefined,
        year: year ? parseInt(year, 10) : undefined,
        venue: venue || undefined,
        institution: institution || undefined,
        doi: doi || undefined,
      });
      router.push(`/papers/${id}/confirm`);
    } catch {
      setSubmitError("Failed to save metadata. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    try {
      await deletePaper(id);
    } finally {
      router.push("/");
    }
  }

  function SuggestButton({ value, current, onAdopt }: { value?: string; current: string; onAdopt: () => void }) {
    if (!value || value === current) return null;
    return (
      <button
        type="button"
        onClick={onAdopt}
        className="mt-1 text-xs text-blue-500 hover:text-blue-700"
      >
        💡 Scholar: &ldquo;{value}&rdquo; [adopt]
      </button>
    );
  }

  if (status === "extracting") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-80 text-center">
          <p className="mb-3 font-medium text-gray-700">Extracting metadata from your PDF…</p>
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(progress, 99)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-400">This usually takes 5–15 seconds</p>
        </div>
      </div>
    );
  }

  const scholarAuthorsStr = scholar?.authors?.join(", ");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="mb-4 block text-sm text-gray-500 hover:text-gray-800">
        ← Library
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Review Paper Metadata</h1>
      <p className="mb-6 text-sm text-gray-500">
        Extracted automatically — review and confirm before processing begins.
      </p>

      <form onSubmit={handleConfirm} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <SuggestButton value={scholar?.title} current={title} onAdopt={() => setTitle(scholar!.title!)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Authors</label>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Comma-separated names"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <SuggestButton value={scholarAuthorsStr} current={authors} onAdopt={() => setAuthors(scholarAuthorsStr!)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SuggestButton
              value={scholar?.year?.toString()}
              current={year}
              onAdopt={() => setYear(scholar!.year!.toString())}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="OSDI, NeurIPS…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <SuggestButton value={scholar?.venue} current={venue} onAdopt={() => setVenue(scholar!.venue!)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Google Brain, MIT CSAIL…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            DOI
            {scholar?.doi && <span className="ml-2 text-xs text-blue-500">from Semantic Scholar</span>}
          </label>
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.1145/…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Confirm & Process →"}
          </button>
        </div>
      </form>
    </div>
  );
}
