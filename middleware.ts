export { auth as middleware } from "@/auth";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!api|_next/static|_next/image|icons|manifest.webmanifest|sw.js|favicon.ico).*)"],
};
