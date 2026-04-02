import type { Paper, ContentItem, Topic, TopicPaper, UserAnnotation, PaperMetadataResponse, VenueEntry, CoachResponse, PhraseItem, PhraseFavorite, UserProfile, ModelConfigOut, ModelConfigIn, TestResult, ProviderPreset, NoteItem, ModuleSummary } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, `API ${res.status} ${path}: ${text}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

// ---------- Papers ----------

export const getPapers = (params?: { q?: string; venue?: string; year?: number }) => {
  const qs = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : "";
  return request<Paper[]>(`/papers${qs ? `?${qs}` : ""}`);
};

export const getPaper = (id: string) => request<Paper>(`/papers/${id}`);

export const getFullAnalysis = (id: string) => request<Paper>(`/papers/${id}/full`);

export const uploadPaper = (form: FormData) =>
  fetch(`${BASE_URL}/papers`, { method: "POST", body: form }).then(async (r) => {
    if (!r.ok) throw new Error(`Upload failed: ${await r.text()}`);
    return r.json() as Promise<Paper>;
  });

export async function getPaperMetadata(id: string): Promise<PaperMetadataResponse> {
  return request<PaperMetadataResponse>(`/papers/${id}/metadata`);
}

export async function confirmPaperMetadata(
  id: string,
  data: {
    title: string;
    authors?: string;
    year?: number;
    venue?: string;
    institution?: string;
    doi?: string;
  }
): Promise<Paper> {
  return request<Paper>(`/papers/${id}/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deletePaper(id: string): Promise<void> {
  await request<void>(`/papers/${id}`, { method: "DELETE" });
}

export const confirmItems = (
  paperId: string,
  confirmations: { item_id: string; module_type: string }[]
) =>
  request<{ status: string; analyzing: number }>(`/papers/${paperId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ confirmations }),
  });

// ---------- Content ----------

export const getContent = (params?: { module_type?: string; venue?: string; paper_id?: string }) => {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
  return request<ContentItem[]>(`/content${qs ? `?${qs}` : ""}`);
};

export const getContentItem = (id: string) => request<ContentItem>(`/content/${id}`);

export const searchContent = (q: string, module_type?: string) => {
  const params: Record<string, string> = { q };
  if (module_type) params.module_type = module_type;
  return request<ContentItem[]>(`/content/search?${new URLSearchParams(params)}`);
};

export const getSimilarItems = (itemId: string, topK = 5) =>
  request<ContentItem[]>(`/content/${itemId}/similar?top_k=${topK}`);

export const getAnnotations = (itemId: string) =>
  request<UserAnnotation[]>(`/content/${itemId}/annotations`);

export const addAnnotation = (itemId: string, body: { note_text: string; tags: string[] }) =>
  request<UserAnnotation>(`/content/${itemId}/annotations`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteAnnotation = (itemId: string, annotationId: string) =>
  request(`/content/${itemId}/annotations/${annotationId}`, { method: "DELETE" });

// ---------- Topics ----------

export const getTopics = () => request<Topic[]>("/topics");

export const getTopic = (id: string) => request<Topic>(`/topics/${id}`);

export const createTopic = (body: { name: string; description?: string }) =>
  request<Topic>("/topics", { method: "POST", body: JSON.stringify(body) });

export const addPaperToTopic = (topicId: string, body: { paper_id: string; order?: number }) =>
  request<TopicPaper>(`/topics/${topicId}/papers`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePaperProgress = (
  topicId: string,
  paperId: string,
  progress: Record<string, boolean>
) =>
  request<TopicPaper>(`/topics/${topicId}/papers/${paperId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_json: progress }),
  });

export const removePaperFromTopic = (topicId: string, paperId: string) =>
  request(`/topics/${topicId}/papers/${paperId}`, { method: "DELETE" });

export const updateTopic = (topicId: string, body: { name?: string; description?: string }) =>
  request<Topic>(`/topics/${topicId}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteTopic = (topicId: string) =>
  request<{ status: string }>(`/topics/${topicId}`, { method: "DELETE" });

export const updatePaperOrder = (topicId: string, paperId: string, order: number) =>
  request<TopicPaper>(`/topics/${topicId}/papers/${paperId}`, {
    method: "PATCH",
    body: JSON.stringify({ order }),
  });

export const retryAnalysis = (itemId: string) =>
  request<{ status: string; item_id: string }>(`/content/${itemId}/retry`, {
    method: "POST",
  });

export const importFromArxiv = (url: string) =>
  request<Paper>("/papers/arxiv", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

export const getVenues = () => request<VenueEntry[]>("/papers/venues");

// ─── Writing Coach ──────────────────────────────────────────────────────────

export const getWritingFeedback = (body: {
  draft_text: string;
  mode: "abstract" | "intro_paragraph" | "related_work_paragraph";
  exemplar_item_ids?: string[];
}) =>
  request<CoachResponse>("/writing-coach/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });

// ─── Phrase Library ─────────────────────────────────────────────────────────

export const getPhrases = (params?: { function?: string; venue?: string }) => {
  const qs = params
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null) as [string, string][]
        )
      ).toString()
    : "";
  return request<PhraseItem[]>(`/content/phrases${qs ? `?${qs}` : ""}`);
};

export const getPhraseFavorites = () =>
  request<PhraseFavorite[]>("/content/phrases/favorites");

// ─── Settings ───────────────────────────────────────────────────────────────

export const getProfile = () => request<UserProfile>("/settings/profile");

export const updateProfile = (body: Partial<UserProfile>) =>
  request<UserProfile>("/settings/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const getModelConfig = () => request<ModelConfigOut>("/settings/model");

export const updateModelConfig = (body: ModelConfigIn) =>
  request<ModelConfigOut>("/settings/model", {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const testModelConnection = () =>
  request<TestResult>("/settings/model/test", { method: "POST" });

export const getModelPresets = () => request<ProviderPreset[]>("/settings/model/presets");

// ─── Notes Hub ───────────────────────────────────────────────────────────────

export const getNotesByModule = (moduleType?: string) => {
  const qs = moduleType ? `?module_type=${encodeURIComponent(moduleType)}` : "";
  return request<NoteItem[]>(`/notes/items${qs}`);
};

export const getModuleSummary = (moduleType: string) =>
  request<ModuleSummary>(`/notes/summary/${encodeURIComponent(moduleType)}`);

export const updateModuleSummary = (
  moduleType: string,
  body: { principles?: string; materials?: string }
) =>
  request<ModuleSummary>(`/notes/summary/${encodeURIComponent(moduleType)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
