import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">DBG Elétrica e Pintura</h1>
        <p className="text-muted-foreground text-sm">Fundação Fase 1 — Slice 1</p>
      </div>

      {session?.user ? (
        <div className="bg-card border-border flex w-full max-w-md flex-col items-center gap-3 rounded-lg border p-6 shadow-sm">
          <p className="text-card-foreground text-sm">
            Olá, <strong>{session.user.name}</strong>
          </p>
          <p className="text-muted-foreground text-xs">{session.user.email}</p>
          <div className="bg-muted text-muted-foreground w-full rounded-md p-3 text-xs">
            <div>
              Role: <code className="text-foreground">{session.user.role}</code>
            </div>
            <div>
              Técnico: <code className="text-foreground">{String(session.user.isTecnico)}</code>
            </div>
            <div>
              Módulos:{" "}
              <code className="text-foreground">{session.user.modulos.join(", ") || "—"}</code>
            </div>
          </div>
          <div className="flex gap-2">
            {session.user.role !== "cliente" && (
              <Link href="/admin" className={buttonVariants({ size: "sm" })}>
                Painel Admin
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <Button type="submit" size="lg">Entrar com Google</Button>
        </form>
      )}
    </main>
  );
}
