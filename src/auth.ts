import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { membro } from "@/db/schema";
import {
  detectRole,
  type MembroLookup,
  type Modulo,
  type Role,
} from "@/auth/role-detection";

declare module "next-auth" {
  interface Session {
    user: {
      role: Role;
      modulos: Modulo[];
      isTecnico: boolean;
    } & DefaultSession["user"];
  }
}

const lookupMembro: MembroLookup = async (email) => {
  const [row] = await db
    .select({
      modulos: membro.modulos,
      isTecnico: membro.isTecnico,
      ativo: membro.ativo,
    })
    .from(membro)
    .where(eq(membro.email, email))
    .limit(1);

  if (!row) return null;
  return {
    modulos: row.modulos as Modulo[],
    isTecnico: row.isTecnico,
    ativo: row.ativo,
  };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user?.email);
    },
    async jwt({ token, user, trigger }) {
      const email = user?.email ?? token.email;
      if ((trigger === "signIn" || trigger === "signUp" || !token.role) && email) {
        const detected = await detectRole(email, process.env.ADMIN_EMAIL, lookupMembro);
        token.role = detected.role;
        token.modulos = detected.modulos;
        token.isTecnico = detected.isTecnico;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = (token.role as Role) ?? "cliente";
      session.user.modulos = (token.modulos as Modulo[]) ?? [];
      session.user.isTecnico = Boolean(token.isTecnico);
      return session;
    },
  },
});
