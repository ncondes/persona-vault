import { AppDetail } from "@/components/console/app-detail";

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppDetail id={id} />;
}
