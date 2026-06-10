import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { urlWhatsApp, REGIAO_ATENDIMENTO } from "@/lib/contato";

const LINKS_NAVEGACAO = [
  { href: "/#servicos", label: "Serviços e preços" },
  { href: "/#portfolio", label: "Trabalhos realizados" },
  { href: "/#equipe", label: "Nossa equipe" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/planos", label: "Planos de manutenção" },
] as const;

export function SiteFooter({ bairros = [] }: { bairros?: string[] }) {
  const ano = new Date().getFullYear();
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-10 max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
        <div>
          <div className="font-bold">DBG Elétrica e Pintura</div>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            Empresa de serviços residenciais de elétrica, pintura e drywall.
            Preço fixo divulgado antes da visita, garantia formal de mão de
            obra e fotos do antes e depois em todo serviço.
          </p>
        </div>
        <div>
          <div className="font-medium mb-2">Navegue</div>
          <ul className="space-y-1">
            {LINKS_NAVEGACAO.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-2">Áreas atendidas</div>
          {bairros.length > 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {bairros.join(" · ")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {REGIAO_ATENDIMENTO}
            </p>
          )}
        </div>
        <div>
          <div className="font-medium mb-2">Contato</div>
          <a
            href={urlWhatsApp("Olá! Quero falar com a DBG.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Segunda a Sábado · 8h às 18h
          </p>
        </div>
      </div>
      <div className="border-t">
        <div className="container mx-auto px-4 py-4 max-w-5xl text-xs text-muted-foreground">
          © {ano} DBG Elétrica e Pintura
        </div>
      </div>
    </footer>
  );
}
