import { signIn } from "@/lib/auth";

export async function GET() {
  return await signIn("google", { redirectTo: "/dashboard/settings" });
}

