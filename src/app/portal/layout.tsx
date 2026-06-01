import type { ReactNode } from "react";
import { SiteFooter } from "../_landing/site-footer";
import { SiteHeader } from "../_landing/site-header";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
