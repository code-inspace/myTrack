import { redirect } from "next/navigation";

export default function DashboardRedirect() {
  redirect("/bilan?tab=analyse");
}
