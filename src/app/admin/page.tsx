import Link from "next/link";
import type { Route } from "next";
import { Boxes, Users, Wrench } from "lucide-react";
import { auth } from "@/auth";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { listarMembros } from "@/equipe/listar-membros";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { db } from "@/db/client";
import type { Modulo } from "@/auth/role-detection";

interface ModuloCard {
  href: Route;
  titulo: string;
  descricao: string;
  icon: typeof Boxes;
  modulo: Modulo;
}

const MODULOS: ModuloCard[] = [
  {
    href: "/admin/catalogo",
    titulo: "Catálogo de Serviços",
    descricao: "Cadastra serviços, preços e prazos de garantia",
    icon: Boxes,
    modulo: "CATALOGO",
  },
  {
    href: "/admin/equipe",
    titulo: "Equipe",
    descricao: "Cadastra membros internos e técnicos de campo",
    icon: Users,
    modulo: "EQUIPE",
  },
];

function KpiCard({
  titulo,
  valor,
  detalhe,
  icon: Icon,
}: {
  titulo: string;
  valor: number;
  detalhe: string;
  icon: typeof Boxes;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{titulo}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="text-3xl font-bold tabular-nums">{valor}</div>
      <div className="text-xs text-muted-foreground mt-1">{detalhe}</div>
    </div>
  );
}

export default async function AdminHome() {
  const session = await auth();
  const modulos = session?.user.modulos ?? [];
  const isAdmin = session?.user.role === "admin_raiz";

  const visiveis = MODULOS.filter(
    (m) => isAdmin || modulos.includes(m.modulo),
  );

  const mostraServicos = isAdmin || modulos.includes("CATALOGO");
  const mostraEquipe = isAdmin || modulos.includes("EQUIPE");

  const [servicos, membros] = await Promise.all([
    mostraServicos
      ? listarServicos({ ativo: true, perPage: 1 }, criarServicoRepoDrizzle(db))
      : Promise.resolve({ total: 0, itens: [] }),
    mostraEquipe
      ? listarMembros({ ativo: true, perPage: 1 }, criarMembroRepoDrizzle(db))
      : Promise.resolve({ total: 0, itens: [] }),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Olá, {session?.user.name?.split(" ")[0] ?? "admin"}. Você tem acesso a{" "}
          {isAdmin ? "todos os módulos" : `${modulos.length} módulo(s)`}.
        </p>
      </div>

      {(mostraServicos || mostraEquipe) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {mostraServicos && (
            <KpiCard
              titulo="Serviços ativos"
              valor={servicos.total}
              detalhe="No catálogo"
              icon={Wrench}
            />
          )}
          {mostraEquipe && (
            <KpiCard
              titulo="Membros ativos"
              valor={membros.total}
              detalhe="Técnicos + internos"
              icon={Users}
            />
          )}
        </div>
      )}

      {visiveis.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Módulos
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visiveis.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group rounded-lg border bg-card p-5 hover:border-foreground/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <m.icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium">{m.titulo}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {m.descricao}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
