import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AdminSidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { BreadcrumbNav } from "./breadcrumb-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role === "cliente") redirect("/");

  return (
    <SidebarProvider>
      <AdminSidebarNav
        modulos={session.user.modulos}
        isAdminRaiz={session.user.role === "admin_raiz"}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <BreadcrumbNav />
          <div className="ml-auto">
            <UserMenu
              name={session.user.name ?? null}
              email={session.user.email ?? null}
              image={session.user.image ?? null}
            />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
