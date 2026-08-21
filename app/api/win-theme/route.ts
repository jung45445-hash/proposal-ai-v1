import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SYSTEM = `당신은 전시·체험사업 입찰 제안전략가다. 사업/RFP 분석, 자동 지역·발주처 리서치, 사용자의 전략 인터뷰 답변을 근거로 수주전략의 중심이 되는 Win Theme 후보를 만든다.
Win Theme은 멋있는 슬로건이 아니라 고객 중요성, 사업특화성, 차별성, 실행가능성, 증거 가능성을 함께 만족해야 한다.
블라인드 심사를 고려해 회사명·회사규모·고유실적·특정 인력 등 업체를 식별할 수 있는 요소를 차별화 근거로 사용하지 않는다.
지방자치단체 사업은 지역 역사·산업·문화·자연·장소성·정책방향의 근거를 적극 활용하되 확인되지 않은 내용을 만들지 않는다.
제공되지 않은 회사 실적이나 사실을 만들지 않는다. 근거가 부족하면 evidence_gap에 명시한다. 반드시 JSON만 출력한다.`;

async function loadAutoResearch(projectName: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("project_name", projectName)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!project?.id) return null;

    const { data } = await supabase
      .from("analysis_results")
      .select("result")
      .eq("project_id", project.id)
      .eq("analysis_type", "auto_research")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.result || null;
  } catch (error) {
    console.error("auto research load error", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    const { projectName, analysisContext, questions, answers } = await request.json();
    if (!analysisContext) return NextResponse.json({ error: "사업/RFP 분석 결과가 필요합니다." }, { status: 400 });

    const autoResearch = projectName ? await loadAutoResearch(projectName) : null;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-5.4",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `사업명: ${projectName || "미입력"}\n\n[사업/RFP 분석]\n${analysisContext}\n\n[자동 지역·발주처 리서치]\n${autoResearch ? JSON.stringify(autoResearch) : "저장된 자동 리서치 없음"}\n\n[전략 질문]\n${JSON.stringify(questions)}\n\n[사용자 답변]\n${JSON.stringify(answers)}\n\n3~5개의 Win Theme 후보를 생성하라. JSON 구조: {strategy_summary:{customer_insight,pain_points:[],hot_buttons:[],regional_logic:[],recommended_direction}, themes:[{id,name,statement,customer_reason,locality_reason,differentiation,evidence:[],evidence_gap:[],related_requirements:[],related_evaluations:[]}], recommended_theme_id, recommendation_reason}. 사용자 답변을 최우선으로 반영하되 RFP 및 자동 리서치와 충돌하면 그 위험을 recommendation_reason에 명시하라.` },
      ],
    });
    return NextResponse.json({ result: JSON.parse(response.choices[0]?.message?.content || "{}") });
  } catch (error: unknown) {
    console.error("win theme error", error);
    const e = error as { message?: string; status?: number };
    return NextResponse.json({
      error: "Win Theme 생성에 실패했습니다.",
      detail: e.message || "원인을 확인할 수 없습니다.",
    }, { status: typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500 });
  }
}
