import { Card, CardContent } from "@/components/ui/card";

export interface KpiCardProps {
  label: string;
  value: number;
}

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
