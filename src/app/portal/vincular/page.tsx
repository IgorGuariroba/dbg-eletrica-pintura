import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FormularioVinculacao } from "./formulario-vinculacao";

export const metadata = {
  title: "Vincular Conta — DBG Elétrica e Pintura",
  description: "Vincule sua conta do Google com seu WhatsApp para acessar o portal do cliente.",
};

export default async function VincularPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Se a role não for cliente, redireciona para a home
  if (session.user.role !== "cliente") {
    redirect("/");
  }

  // Se já possuir WhatsApp vinculado, redireciona para a home do portal
  if (session.user.whatsapp) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Elemento de background decorativo para design premium */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      <div className="z-10 flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Acesso ao Portal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            DBG Elétrica e Pintura
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            Olá, <span className="font-semibold text-foreground">{session.user.name}</span> ({session.user.email}). Falta apenas um passo para acessar sua área exclusiva.
          </p>
        </div>

        <FormularioVinculacao />
      </div>
    </main>
  );
}
