"use client";

import Link from "next/link";
import { FORBIDDEN_DIGEST_PREFIX } from "@/auth/require-modulo";

export default function CatalogoError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const forbidden = error.digest?.startsWith(FORBIDDEN_DIGEST_PREFIX) ?? false;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2">
        {forbidden ? "403 — Acesso negado" : "Erro inesperado"}
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        {forbidden
          ? "Sua conta não tem permissão para acessar o módulo Catálogo."
          : "Tente novamente. Se persistir, contate o admin."}
      </p>
      <Link href="/admin" className="text-sm underline">
        Voltar
      </Link>
    </div>
  );
}
