import FullAnalysisPage from "@/components/detail/FullAnalysisPage";

export default function PaperDetailPage({ params }: { params: { id: string } }) {
  return <FullAnalysisPage paperId={params.id} />;
}
