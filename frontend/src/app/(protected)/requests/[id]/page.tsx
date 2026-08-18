import { RequestDetail } from "@/components/assistant/RequestDetail";

export default async function RequestDetailPage({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <RequestDetail requestId={id} />
    </div>
  );
}
