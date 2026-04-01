import WritingCoachPage from "@/components/writing/WritingCoachPage";

export default function Page({
  searchParams,
}: {
  searchParams: { exemplar?: string };
}) {
  return <WritingCoachPage initialExemplarId={searchParams.exemplar} />;
}
