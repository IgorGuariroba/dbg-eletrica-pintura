import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ItemLista {
  chave: string;
  label: string;
  valor?: string | number;
}

// Teto de linhas exibidas: mantém a densidade sob controle (§10) mesmo quando a
// fonte tem centenas de itens; o excedente é resumido no rodapé.
const MAX_LINHAS = 8;

export function ListaDashboard({
  titulo,
  descricao,
  itens,
  vazio,
  max = MAX_LINHAS,
}: {
  titulo: string;
  descricao?: string;
  itens: ItemLista[];
  vazio: string;
  max?: number;
}) {
  const visiveis = itens.slice(0, max);
  const restantes = itens.length - visiveis.length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visiveis.map((item) => (
                <li
                  key={item.chave}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  {item.valor !== undefined && (
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
                      {item.valor}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {restantes > 0 && (
              <p className="pt-3 text-xs text-muted-foreground">
                + {restantes} {restantes === 1 ? "outro" : "outros"}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
