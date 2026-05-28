import { auth } from "@/auth";

export default auth;

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!api|_next/static|_next/image|icons|manifest.webmanifest|sw.js|favicon.ico).*)"],
};
