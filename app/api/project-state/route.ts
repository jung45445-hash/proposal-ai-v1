import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { projectId, analysisType, result } = await request.json();
    const id = Number(projectId);
    if (!id || !analysisType || result === undefined) {
      return NextResponse.json({ error: "projectId, analysisType, result가 필요합니다." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("analysis_results").insert({
      project_id: id,
      analysis_type: String(analysisType),
      result,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("project-state POST error", error);
    return NextResponse.json({ error: "프로젝트 작업결과를 저장하지 못했습니다." }, { status: 500 });
  }
}
