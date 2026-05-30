import { ExecucaoView } from "@/features/campo/components/execucao-view";

export default async function ExecucaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExecucaoView osId={id} />;
}
