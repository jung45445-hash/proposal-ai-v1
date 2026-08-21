import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!id) return NextResponse.json({ error: "잘못된 프로젝트 ID입니다." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const [{ data: project, error: projectError }, { data: analyses, error: analysisError }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("analysis_results").select("id, analysis_type, result, created_at, updated_at").eq("project_id", id).order("created_at", { ascending: false }),
    ]);

    if (projectError) throw projectError;
    if (analysisError) throw analysisError;

    const latest: Record<string, unknown> = {};
    for (const row of analyses || []) {
      if (!(row.analysis_type in latest)) latest[row.analysis_type] = row.result;
    }

    return NextResponse.json({ project, latest, history: analyses || [] });
  } catch (error) {
    console.error("project detail GET error", error);
    return NextResponse.json({ error: "프로젝트를 불러오지 못했습니다." }, { status: 500 });
  }
}
