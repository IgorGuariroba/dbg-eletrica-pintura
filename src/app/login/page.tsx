import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Entrar — DBG Elétrica e Pintura",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role !== "cliente") redirect("/admin");
    redirect("/");
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground text-sm">
          Acesso restrito a clientes e equipe.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/login" });
        }}
      >
        <Button type="submit" size="lg">
          Entrar com Google
        </Button>
      </form>

      <Link href="/" className="text-xs text-muted-foreground underline">
        Voltar para a página inicial
      </Link>
    </main>
  );
}
