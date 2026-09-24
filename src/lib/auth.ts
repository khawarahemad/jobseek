import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify",
        },
      },
    }),
    Credentials({
      id: "demo",
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string) || "khawar@jobops.dev";
        const name = (credentials?.name as string) || "Khawar Ahemad Khan";

        // Find or create user for demo / quick preview
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            },
          });

          // Seed default sample jobs for the user
          await prisma.job.createMany({
            data: [
              {
                userId: user.id,
                company: "Trail of Bits",
                title: "Security Researcher",
                status: "EMAILED",
                hrEmail: "recruiting@trailofbits.com",
                customContext: "Specializes in binary analysis, fuzzing, and cryptographic engineering.",
              },
              {
                userId: user.id,
                company: "Supabase",
                title: "Infrastructure Engineer",
                status: "INTERVIEWING",
                hrEmail: "careers@supabase.com",
                customContext: "Open-source Firebase alternative built on PostgreSQL and Elixir.",
              },
              {
                userId: user.id,
                company: "Careem",
                title: "Backend Engineer",
                status: "REPLIED",
                hrEmail: "talent@careem.com",
                customContext: "MENA super-app expanding ride-hailing and fintech microservices.",
              },
              {
                userId: user.id,
                company: "Vercel",
                title: "Systems Engineer",
                status: "SOURCED",
                hrEmail: "jobs@vercel.com",
                customContext: "Edge network infrastructure, Next.js optimization, and Turborepo.",
              },
            ],
          });

          // Seed default templates
          await prisma.template.createMany({
            data: [
              {
                userId: user.id,
                name: "Security & Reverse Engineering",
                category: "Security",
                subject: "Systems & Security Engineer – {{candidate_name}} ({{company}} Outreach)",
                body: "Hi {{hr_name}},\n\nReaching out because I've been following {{company_context}} and wanted to explore opportunities as an offensive security / systems engineer.\n\nMy core focus is low-level systems, reverse engineering, and exploit mitigation. I've built autonomous vulnerability scanning frameworks and practical memory forensics tooling.\n\nWould love to connect if you have 5 minutes this week.\n\nBest,\n{{candidate_name}}",
              },
              {
                userId: user.id,
                name: "Cloud & Infrastructure",
                category: "Infrastructure",
                subject: "Distributed Systems & Cloud Engineer – {{candidate_name}} for {{company}}",
                body: "Hi {{hr_name}},\n\nI'm reaching out regarding engineering opportunities at {{company}}. Given your work around {{company_context}}, I wanted to see if your team is looking for engineers who specialize in high-throughput backend services and distributed databases.\n\nLooking forward to hearing from you,\n{{candidate_name}}",
              },
            ],
          });
        }

        return user;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
      }
      if (account?.refresh_token) {
        try {
          await prisma.account.updateMany({
            where: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
            data: {
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
            },
          });
        } catch (e) {
          console.warn("[Auth] Could not update account tokens:", e);
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
});
