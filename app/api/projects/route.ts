import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function dbErrorResponse(action: "목록" | "저장", error: unknown) {
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  const detail = [e.message, e.details, e.hint, e.code].filter(Boolean).join(" | ") || "원인을 확인할 수 없습니다.";
  const missingEnv = detail.includes("Supabase 서버 환경변수");
  return NextResponse.json({
    error: missingEnv ? "Supabase 서버 환경변수가 현재 배포에 반영되지 않았습니다." : `프로젝트 ${action}에 실패했습니다.`,
    hint: missingEnv
      ? "Vercel 환경변수를 추가한 뒤 새 배포(Redeploy)가 필요합니다."
      : "Supabase URL/Secret Key, projects 테이블, RLS 설정을 확인해주세요.",
    detail,
    stage: "SUPABASE_PROJECTS",
  }, { status: 500 });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("projects")
      .select("id, project_name, client_name, budget, area, status, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ projects: data || [] });
  } catch (error) {
    console.error("projects GET error", error);
    return dbErrorResponse("목록", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectName = String(body.projectName || "").trim();
    if (!projectName) {
      return NextResponse.json({ error: "사업명을 입력해주세요." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        project_name: projectName,
        client_name: body.clientName ? String(body.clientName) : null,
        budget: toNumber(body.budget),
        area: toNumber(body.area),
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ project: data });
  } catch (error) {
    console.error("projects POST error", error);
    return dbErrorResponse("저장", error);
  }
}
