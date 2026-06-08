"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assinarPlanoAction } from "@/app/assinar/[slug]/actions";

interface Props {
  slug: string;
  nomePlano: string;
}

/**
 * Botão de confirmação do checkout digital: dispara a criação do pre-approval
 * no MP e redireciona o cliente para autorizar a cobrança no próprio aparelho.
 */
export function AssinarCta({ slug, nomePlano }: Props) {
  const [pending, startTransition] = useTransition();

  function handleAssinar() {
    startTransition(async () => {
      const res = await assinarPlanoAction(slug);
      if (!res.ok) {
        toast.error(res.erro);
        return;
      }
      window.location.href = res.initPoint;
    });
  }

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={handleAssinar}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Redirecionando…
        </>
      ) : (
        `Assinar ${nomePlano}`
      )}
    </Button>
  );
}
