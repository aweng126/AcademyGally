import TopicStudyPage from "@/components/topic/TopicStudyPage";

export default function TopicPage({ params }: { params: { id: string } }) {
  return <TopicStudyPage topicId={params.id} />;
}
