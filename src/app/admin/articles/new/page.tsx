import { redirect } from "next/navigation";
import { getIsAdmin } from "@/lib/adminAuth";
import { AdminArticleForm } from "@/components/AdminArticleForm";
import { saveArticleAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  if (!(await getIsAdmin())) {
    redirect("/admin/login");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New article</h1>
      <AdminArticleForm action={saveArticleAction} />
    </div>
  );
}
