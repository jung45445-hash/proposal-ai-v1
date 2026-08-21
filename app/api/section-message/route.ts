import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 전시·체험사업 입찰제안의 수석 제안전략가다.
입력된 사업/RFP 분석, 전략 인터뷰, 선택된 Win Theme을 바탕으로 다음 세 가지를 만든다.
1) 핵심 Claim 체계
2) 요구사항 조견표
3) 제안서 Section Message
규칙:
- 제공되지 않은 회사 실적, 수치, 사실을 만들지 않는다.
- 각 Claim은 관련 Requirement/Evaluation과 연결한다.
- 요구사항 조견표는 누락을 드러내야 하며 STRONG/MEDIUM/WEAK/MISSING으로 평가한다.
- Section Message는 단순 목차가 아니라 평가위원이 그 섹션에서 무엇을 이해하고 기억해야 하는지 명확히 한다.
- 전시·체험사업 특성을 반영해 사업이해/공간/콘텐츠/운영/수행/실적 관점의 균형을 보되, RFP에 없는 섹션을 억지로 만들지 않는다.
- 반드시 유효한 JSON만 출력한다.`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    const { projectName, analysisContext, questions, answers, selectedTheme, themes } = await request.json();
    if (!analysisContext || !selectedTheme) return NextResponse.json({ error: "사업분석과 선택된 Win Theme이 필요합니다." }, { status: 400 });

    const theme = (themes || []).find((t: any) => t.id === selectedTheme) || { id: selectedTheme };
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `사업명: ${projectName || "미입력"}\n\n[사업/RFP 분석]\n${analysisContext}\n\n[전략 인터뷰 질문]\n${JSON.stringify(questions)}\n\n[사용자 답변]\n${JSON.stringify(answers)}\n\n[선택 Win Theme]\n${JSON.stringify(theme)}\n\n다음 JSON 구조로 출력하라:\n{\n  \"claims\": [{\"id\":\"CLM-001\",\"claim\":\"\",\"customer_benefit\":\"\",\"proof_needed\":[],\"related_requirements\":[],\"related_evaluations\":[],\"priority\":\"HIGH|MEDIUM|LOW\"}],\n  \"requirement_matrix\": [{\"requirement_id\":\"REQ-001\",\"requirement\":\"\",\"evaluation\":\"\",\"response_strategy\":\"\",\"related_claims\":[],\"recommended_section\":\"\",\"coverage\":\"STRONG|MEDIUM|WEAK|MISSING\",\"gap\":\"\"}],\n  \"sections\": [{\"section_id\":\"SEC-01\",\"section_name\":\"\",\"section_objective\":\"\",\"evaluator_question\":\"\",\"main_message\":\"\",\"supporting_messages\":[],\"related_requirements\":[],\"related_evaluations\":[],\"related_claims\":[],\"win_theme_link\":\"\",\"evidence_needed\":[],\"recommended_pages\":0}],\n  \"quality_notes\": {\"strong_points\":[],\"weak_points\":[],\"missing_evidence\":[],\"priority_actions\":[]}\n}\n섹션 메시지는 제안서에 실제로 사용할 수 있을 정도로 구체적으로 작성하라.` }
      ]
    });
    return NextResponse.json({ result: JSON.parse(response.choices[0]?.message?.content || "{}") });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Section Message 생성에 실패했습니다." }, { status: 500 });
  }
}
