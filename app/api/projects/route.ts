import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
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
    return NextResponse.json({ error: "프로젝트 목록을 불러오지 못했습니다." }, { status: 500 });
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
    return NextResponse.json({ error: "프로젝트를 저장하지 못했습니다." }, { status: 500 });
  }
}
