import { MessageCircle } from "lucide-react";
import { urlWhatsApp } from "@/lib/contato";

export function SiteFooter() {
  const ano = new Date().getFullYear();
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-10 max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="font-bold">DBG Elétrica e Pintura</div>
          <p className="mt-2 text-muted-foreground text-xs">
            Serviços residenciais com transparência, garantia e agendamento
            digital.
          </p>
        </div>
        <div>
          <div className="font-medium mb-2">Fale com a gente</div>
          <a
            href={urlWhatsApp("Olá! Quero falar com a DBG.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </a>
        </div>
        <div>
          <div className="font-medium mb-2">Atendimento</div>
          <p className="text-xs text-muted-foreground">
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
