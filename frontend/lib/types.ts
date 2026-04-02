export type ProcessingStatus = "pending" | "processing" | "done" | "failed" | "awaiting_metadata";
export type ModuleType = "arch_figure" | "abstract" | "eval_figure" | "algorithm" | "other";

export interface Paper {
  id: string;
  title: string;
  venue: string | null;
  year: number | null;
  authors: string | null;
  doi: string | null;
  institution?: string;
  pdf_path: string;
  processing_status: ProcessingStatus;
  uploaded_at: string;
  content_items?: ContentItem[];
}

export interface ContentItem {
  id: string;
  paper_id: string;
  module_type: ModuleType;
  image_path: string | null;
  page_number: number | null;
  caption: string | null;
  analysis_json: ArchFigureAnalysis | AbstractAnalysis | EvalFigureAnalysis | AlgorithmAnalysis | null;
  processing_status: ProcessingStatus;
  created_at: string;
}

export interface ArchFigureAnalysis {
  components: { name: string; role: string }[];
  dataflow: string[];
  core_problem: string;
  design_insight: string;
  tradeoffs: string[];
  related_systems: string[];
}

export interface AbstractAnalysis {
  problem_statement: string;
  proposed_approach: string;
  key_contributions: string[];
  evaluation_summary: string;
  keywords: string[];
  novelty_claim: string;
  rubric?: AbstractRubric;       // added by updated prompt
  key_phrases?: KeyPhrase[];     // added by updated prompt
}

export interface EvalFigureAnalysis {
  figure_type: "bar" | "line" | "heatmap" | "table";
  metrics: string[];
  baselines: string[];
  headline_result: string;
  workload_desc: string;
  caveats: string[];
}

export interface AlgorithmAnalysis {
  algorithm_name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  key_steps: string[];
  complexity: string;
  novelty: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  papers?: TopicPaper[];
}

export interface TopicPaper {
  topic_id: string;
  paper_id: string;
  order: number;
  progress_json: Record<string, boolean>;
  available_modules?: string[];
  paper?: Paper;
}

export interface UserAnnotation {
  id: string;
  item_id: string;
  note_text: string;
  tags: string[];
  created_at: string;
}

export interface VlmMetadataResult {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  institution?: string;
}

export interface ScholarSuggestion {
  title?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
}

export interface PaperMetadataResponse {
  id: string;
  status: "extracting" | "ready";
  vlm_result?: VlmMetadataResult;
  scholar_suggestion?: ScholarSuggestion;
}

export interface VenueYear {
  year: number;
  count: number;
}

export interface VenueEntry {
  venue: string;
  total: number;
  years: VenueYear[];
}

// ─── Abstract Rubric (Feature 1) ───────────────────────────────────────────

export interface RubricDimension {
  score: number;      // 1–5
  rationale: string;
}

export interface AbstractRubric {
  problem_clarity: RubricDimension;
  contribution_specificity: RubricDimension;
  novelty_claim_strength: RubricDimension;
  evaluation_evidence_quality: RubricDimension;
  writing_quality: RubricDimension;
}

export type PhraseFunction =
  | "problem_setup"
  | "contribution_claim"
  | "evaluation_framing"
  | "positioning"
  | "methodology"
  | "limitation";

export interface KeyPhrase {
  text: string;
  function: PhraseFunction;
  why_effective: string;
}

// ─── Writing Coach (Feature 2) ─────────────────────────────────────────────

export interface CoachIssue {
  dimension: string;
  severity: "critical" | "moderate" | "minor";
  description: string;
  suggestion: string;
  exemplar_ref: number | null;
}

export interface CoachExemplarUsed {
  item_id: string;
  paper_title: string;
  snippet: string;
}

export interface CoachResponse {
  overall_score: number;
  summary: string;
  strengths: string[];
  issues: CoachIssue[];
  suggested_rewrite: string;
  positioning_notes: string | null;
  exemplars_used: CoachExemplarUsed[];
}

// ─── Phrase Pattern Library (Feature 3) ────────────────────────────────────

export interface PhraseItem {
  item_id: string;
  paper_id: string;
  paper_title: string;
  venue: string | null;
  year: number | null;
  text: string;
  function: PhraseFunction;
  why_effective: string;
}

// ─── Notes Hub ────────────────────────────────────────────────────────────

export interface NoteItem {
  annotation_id: string;
  item_id: string;
  paper_id: string;
  paper_title: string;
  venue: string | null;
  year: number | null;
  module_type: string;
  item_caption: string | null;
  note_text: string;
  tags: string[];
  created_at: string;
}

export interface ModuleSummary {
  module_type: string;
  principles: string | null;
  materials: string | null;
  updated_at: string | null;
}

export interface PhraseFavorite {
  annotation_id: string;
  item_id: string;
  paper_id: string | null;
  paper_title: string;
  text: string;
  tags: string[];
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface UserProfile {
  display_name: string | null;
  institution: string | null;
  research_area: string | null;
  research_interests: string[];
  academic_stage: string | null;
  default_view: "library" | "topic" | "browse";
  analysis_language: "english" | "chinese" | "auto";
  auto_retry: boolean;
}

export interface ModelConfigOut {
  preset: string | null;
  provider: string | null;
  anthropic_api_key_hint: string | null;
  vlm_api_key_hint: string | null;
  vlm_base_url: string | null;
  vlm_model: string | null;
  vlm_text_model: string | null;
  last_test_status: "ok" | "failed" | null;
  last_test_latency_ms: number | null;
  last_tested_at: string | null;
  effective_provider: string;
  effective_model: string;
  config_source: "database" | "environment";
}

export interface ModelConfigIn {
  preset?: string;
  provider?: string;
  anthropic_api_key?: string;
  vlm_api_key?: string;
  vlm_base_url?: string;
  vlm_model?: string;
  vlm_text_model?: string | null;
}

export interface TestResult {
  status: "ok" | "failed";
  latency_ms: number | null;
  model: string | null;
  provider: string | null;
  error: string | null;
}

export interface ProviderPreset {
  id: string;
  label: string;
  provider: "anthropic" | "openai_compatible";
  base_url: string | null;
  vision_models: string[];
  text_models: string[];
  api_key_hint: string;
  docs_url: string;
}
