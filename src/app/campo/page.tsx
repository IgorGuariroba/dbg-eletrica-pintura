import Link from "next/link";
import type { Route } from "next";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { InstallPrompt } from "@/features/campo/components/install-prompt";
import { OsAtribuidasList } from "@/features/campo/components/os-atribuidas-list";

export default function CampoPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Minhas OS</h1>
        <Link
          href={"/campo/express/nova" as Route}
          className={buttonVariants({ size: "sm" })}
        >
          <Plus className="mr-1 size-4" />
          Nova Express
        </Link>
      </div>
      <InstallPrompt />
      <OsAtribuidasList />
    </div>
  );
}
