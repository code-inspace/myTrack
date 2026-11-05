import { redirect } from "next/navigation";

export default function GoalsRedirect() {
  redirect("/bilan?tab=objectifs");
}
