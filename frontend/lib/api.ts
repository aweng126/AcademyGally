const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// Papers
export const getPapers = () => request<import("./types").Paper[]>("/papers");
export const getPaper = (id: string) => request<import("./types").Paper>(`/papers/${id}`);
export const getFullAnalysis = (id: string) => request<import("./types").Paper>(`/papers/${id}/full`);
export const uploadPaper = (form: FormData) =>
  fetch(`${BASE_URL}/papers`, { method: "POST", body: form }).then((r) => r.json());

// Content
export const getContent = (params?: { module_type?: string; venue?: string }) => {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return request<import("./types").ContentItem[]>(`/content${qs ? `?${qs}` : ""}`);
};
export const getContentItem = (id: string) =>
  request<import("./types").ContentItem>(`/content/${id}`);
export const searchContent = (q: string, module_type?: string) => {
  const qs = new URLSearchParams({ q, ...(module_type ? { module_type } : {}) }).toString();
  return request<import("./types").ContentItem[]>(`/content/search?${qs}`);
};
export const addAnnotation = (itemId: string, body: { note_text: string; tags: string[] }) =>
  request(`/content/${itemId}/annotations`, { method: "POST", body: JSON.stringify(body) });

// Topics
export const getTopics = () => request<import("./types").Topic[]>("/topics");
export const createTopic = (body: { name: string; description?: string }) =>
  request<import("./types").Topic>("/topics", { method: "POST", body: JSON.stringify(body) });
export const addPaperToTopic = (topicId: string, body: { paper_id: string; order?: number }) =>
  request(`/topics/${topicId}/papers`, { method: "POST", body: JSON.stringify(body) });
export const updatePaperProgress = (
  topicId: string,
  paperId: string,
  progress: Record<string, boolean>
) =>
  request(`/topics/${topicId}/papers/${paperId}`, {
    method: "PATCH",
    body: JSON.stringify({ progress_json: progress }),
  });
