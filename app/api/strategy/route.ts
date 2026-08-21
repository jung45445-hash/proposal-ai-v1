import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SYSTEM = `당신은 공공 전시·체험사업 전문 제안전략가다.
목표는 일반적인 아이디어 나열이 아니라 발주처 의도, 지역성, 장소성, 사업예산, 공간조건, 운영조건을 결합해 실제 심사에서 기억될 전략 선택을 돕는 것이다.

중요 규칙:
1. 제한경쟁입찰의 참가자격·면허·회사규모·회사명·고유실적·인력 등 업체를 특정할 수 있는 정보는 전략 질문이나 차별화 근거로 사용하지 않는다. 블라인드/공정성 원칙을 우선한다.
2. 이미 RFP에서 확인된 사실을 다시 질문하지 않는다. AI만으로 결정하기 어려운 '선택'만 묻는다.
3. 질문은 사업특화성이 높은 순서로 5~7개만 만든다: 발주처 핵심의도, 지역/장소 정체성, 메인 컨셉, 공간경험, 대표 콘텐츠, 기술 적용수준, 예산 선택집중, 실행/운영 리스크.
4. 특히 지방자치단체 사업은 지역의 역사·산업·문화·자연·도시이미지·정책방향·장소성을 컨셉으로 발전시킬 수 있도록 질문한다.
5. '혁신·미래·소통·융합'처럼 어느 지역에도 적용 가능한 상투적 표현은 피한다. 다른 지자체 이름으로 바꿔도 성립하는 전략은 낮게 평가한다.
6. 사용자의 선택을 무조건 긍정하지 않는다. RFP 충돌, 단순 연대기화, 과도한 미디어 의존, 유지관리 부담, 예산 과투자, 장소성 부족 가능성이 있으면 reason 또는 risk에 명시한다.
7. 전략 후보는 단순 슬로건이 아니라 '왜 이 사업에서만 성립하는지'가 드러나게 만든다.
8. 각 전략 후보에 distinctiveness(차별성), locality(지역특화성), feasibility(실행가능성)를 high/medium/low로 평가하고 risk를 한 문장으로 쓴다.
9. 회사 관련 질문은 생성하지 않는다.
10. 웹 리서치에서 확인된 사실과 RFP 사실, AI 해석을 구분한다.
11. 반드시 유효한 JSON만 출력한다.`;

async function saveResearch(projectName: string, research: unknown) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("project_name", projectName)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (projectError || !project?.id) return;

    await supabase.from("analysis_results").insert({
      project_id: project.id,
      analysis_type: "auto_research",
      result: research,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("auto research save error", error);
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const { projectName, analysisContext } = await request.json();
    if (!analysisContext) {
      return NextResponse.json({ error: "먼저 사업분석 또는 요구사항 분석을 실행해주세요." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-5.4";

    // 1) 사용자가 별도로 검색하지 않아도 지역·발주처·정책·장소 DNA를 자동 조사한다.
    const researchResponse = await openai.responses.create({
      model,
      tools: [{ type: "web_search_preview" }],
      input: `다음 공공 전시·체험사업의 제안전략을 위해 웹 리서치를 수행하라.\n\n사업명: ${projectName || "미입력"}\n\n[RFP/사업분석]\n${analysisContext}\n\n조사 우선순위:\n- 발주 지방자치단체와 해당 지역의 공식 정책방향 및 최근 중점사업\n- 지역의 역사·산업·문화·자연·도시이미지와 장소 정체성\n- 사업 장소 및 주변 맥락, 기존 관련 문화시설·공공시설의 특징\n- 본 사업의 전시 컨셉으로 발전시킬 수 있는 지역 고유 키워드와 근거\n- 유사 공공 전시시설 사례에서 참고할 점과 피해야 할 상투성\n\n공식 지자체·공공기관·공신력 있는 자료를 우선하라. 회사/경쟁사 정보는 조사하지 않는다. 확인되지 않은 내용은 사실처럼 쓰지 않는다. 각 핵심 사실에 출처 URL을 함께 적어라.`,
    });

    const researchText = researchResponse.output_text || "리서치 결과 없음";

    // 2) 웹 검색 결과와 RFP 분석을 하나의 구조화된 전략 인터뷰로 정리한다.
    const structured = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `프로젝트: ${projectName || "미입력"}\n\n[RFP/사업 분석]\n${analysisContext}\n\n[자동 웹 리서치]\n${researchText}\n\n위 두 자료를 통합해 전략 인터뷰를 생성하라. 사용자가 이미 알려준 내용이나 RFP에서 확정된 사실은 다시 묻지 말고, 컨셉·공간경험·대표콘텐츠·기술·예산 선택집중처럼 실제 의사결정이 필요한 것만 질문하라.\n\nJSON 구조:\n{\n  "research_brief": {\n    "local_government_dna": [],\n    "regional_identity": [],\n    "place_context": [],\n    "policy_signals": [],\n    "concept_opportunities": [],\n    "cautions": [],\n    "sources": [{"title":"","url":"","what_it_supports":""}]\n  },\n  "questions": [{"id":"Q1","question":"","reason":"","options":[]}],\n  "strategy_focus_candidates": [{"name":"","logic":"","distinctiveness":"high|medium|low","locality":"high|medium|low","feasibility":"high|medium|low","risk":""}],\n  "research_needed": []\n}`,
        },
      ],
    });

    const text = structured.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text);

    if (projectName && result.research_brief) {
      await saveResearch(projectName, result.research_brief);
    }

    return NextResponse.json({ result });
  } catch (error: unknown) {
    console.error("strategy interview error", error);
    const e = error as { message?: string; status?: number };
    return NextResponse.json({
      error: "전략 인터뷰 생성에 실패했습니다.",
      hint: "자동 웹 리서치 또는 전략 구조화 단계에서 오류가 발생했습니다.",
      detail: e.message || "원인을 확인할 수 없습니다.",
    }, { status: typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500 });
  }
}
