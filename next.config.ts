import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist({
  reactStrictMode: true,
  typedRoutes: true,
  // Garante que o logo lido server-side (PDF) seja empacotado nas functions —
  // sem isso, `assets/` da raiz não vai pro bundle e o readFileSync falha em
  // deploy (cai no placeholder textual). Ver src/documentos/pdf/componentes.tsx.
  outputFileTracingIncludes: {
    "/**": ["./assets/images/branding/01-logo-dbg.jpeg"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-d9b6217240d14580bf675ccacfd26a3f.r2.dev",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
});
