import { RastreamentoView } from "@/features/campo/components/rastreamento-view";

export default async function OsCampoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RastreamentoView osId={id} />;
}
