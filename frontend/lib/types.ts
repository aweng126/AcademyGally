export type ProcessingStatus = "pending" | "processing" | "done" | "failed";
export type ModuleType = "arch_figure" | "abstract" | "eval_figure" | "algorithm" | "other";

export interface Paper {
  id: string;
  title: string;
  venue: string | null;
  year: number | null;
  authors: string | null;
  doi: string | null;
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
  paper?: Paper;
}

export interface UserAnnotation {
  id: string;
  item_id: string;
  note_text: string;
  tags: string[];
  created_at: string;
}
