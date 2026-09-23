import { redirect } from "next/navigation";

export default function OldTemplatesRedirect() {
  redirect("/dashboard/templates");
}
