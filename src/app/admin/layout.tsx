import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role === "cliente") redirect("/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-bold">
            DBG Admin
          </Link>
          <nav className="text-sm text-muted-foreground flex gap-3">
            <Link href="/admin/catalogo" className="hover:text-foreground">
              Catálogo
            </Link>
          </nav>
        </div>
        <span className="text-xs text-muted-foreground">{session.user.email}</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
