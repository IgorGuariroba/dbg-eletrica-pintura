import { InstallPrompt } from "@/features/campo/components/install-prompt";
import { OsAtribuidasList } from "@/features/campo/components/os-atribuidas-list";

export default function CampoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Minhas OS</h1>
      <InstallPrompt />
      <OsAtribuidasList />
    </div>
  );
}
