import { permanentRedirect } from "next/navigation";

// A solicitação agora acontece direto na landing, na seção #orcamento (form
// embutido — ver _landing/orcamento.tsx). Mantemos a rota /solicitar como
// redirect permanente para não quebrar links de indicação e e-mails de
// remarketing já distribuídos que apontam para cá. O componente do form e as
// server actions (form.tsx / actions.ts) seguem sendo reusados pela landing,
// por /servicos/[slug], /campo/express e /painel.
export default function SolicitarPage() {
  permanentRedirect("/#orcamento");
}
