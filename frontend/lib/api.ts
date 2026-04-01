import type { Paper, ContentItem, Topic, TopicPaper, UserAnnotation, PaperMetadataResponse } from "./types";

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
  return res.json();
}

// ---------- Papers ----------

export const getPapers = (params?: { q?: string; venue?: string }) => {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
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
