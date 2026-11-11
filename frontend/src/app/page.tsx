import { redirect } from "next/navigation";

// AppShell mengarahkan ke /login bila belum masuk, atau ke /menunggu-penugasan bila perlu.
export default function Home() {
  redirect("/dashboard");
}
