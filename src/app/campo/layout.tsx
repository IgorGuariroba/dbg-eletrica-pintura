import { BottomTabs } from "@/features/campo/components/bottom-tabs";
import { OfflineBadge } from "@/features/campo/components/offline-badge";
import { SyncBadge } from "@/features/campo/components/sync-badge";
import { exigirTecnico } from "./guard";

export default async function CampoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirTecnico();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <span className="font-bold">DBG · Campo</span>
        <div className="flex items-center gap-2">
          <SyncBadge />
          <OfflineBadge />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 p-4">{children}</main>
      <BottomTabs />
    </div>
  );
}
