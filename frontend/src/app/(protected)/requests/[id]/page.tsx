import { RequestDetail } from "@/components/assistant/RequestDetail";

export default async function RequestDetailPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  return <RequestDetail requestId={id} />;
}
