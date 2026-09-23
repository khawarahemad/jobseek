import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  // Check if current user has an active Google OAuth connection with a refresh token
  const googleAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "google",
    },
  });

  const isConnected =
    !!googleAccount?.refresh_token ||
    (!!process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.length > 20);

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden">
        <Sidebar user={session.user} isConnected={isConnected} />
        <main className="flex-1 h-full min-h-0 overflow-y-auto bg-[#09090b] relative">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
