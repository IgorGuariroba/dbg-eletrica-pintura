import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role === "cliente") redirect("/");

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="flex h-14 items-center border-b bg-background px-4">
        <Link href={"/painel/fila" as Route} className="font-bold">
          DBG · Painel
        </Link>
      </header>
      <main className="mx-auto max-w-4xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
