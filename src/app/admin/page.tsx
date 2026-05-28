import Link from "next/link";
import { auth } from "@/auth";

export default async function AdminHome() {
  const session = await auth();
  const modulos = session?.user.modulos ?? [];
  const isAdmin = session?.user.role === "admin_raiz";
  const podeCatalogo = isAdmin || modulos.includes("CATALOGO");

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Painel Admin</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Acessa apenas módulos liberados na sua conta.
      </p>
      <ul className="space-y-2">
        {podeCatalogo && (
          <li>
            <Link
              href="/admin/catalogo"
              className="block rounded border border-border p-3 hover:bg-muted"
            >
              <div className="font-medium">Catálogo de Serviços</div>
              <div className="text-xs text-muted-foreground">
                Cadastra serviços, preços e prazos de garantia
              </div>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
