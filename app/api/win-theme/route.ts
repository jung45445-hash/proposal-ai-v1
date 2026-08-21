import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 전시·체험사업 입찰 제안전략가다. 사업/RFP 분석과 사용자의 전략 인터뷰 답변을 근거로 수주전략의 중심이 되는 Win Theme 후보를 만든다.
Win Theme은 멋있는 슬로건이 아니라 고객 중요성, 회사 수행가능성, 차별성, 증거 가능성을 함께 만족해야 한다.
제공되지 않은 회사 실적이나 사실을 만들지 않는다. 근거가 부족하면 evidence_gap에 명시한다. 반드시 JSON만 출력한다.`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    const { projectName, analysisContext, questions, answers } = await request.json();
    if (!analysisContext) return NextResponse.json({ error: "사업/RFP 분석 결과가 필요합니다." }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `사업명: ${projectName || "미입력"}\n\n[사업/RFP 분석]\n${analysisContext}\n\n[전략 질문]\n${JSON.stringify(questions)}\n\n[사용자 답변]\n${JSON.stringify(answers)}\n\n3~5개의 Win Theme 후보를 생성하라. JSON 구조: {strategy_summary:{customer_insight,pain_points:[],hot_buttons:[],recommended_direction}, themes:[{id,name,statement,customer_reason,company_reason,differentiation,evidence:[],evidence_gap:[],related_requirements:[],related_evaluations:[]}], recommended_theme_id, recommendation_reason}. 사용자 답변을 최우선으로 반영하라.` },
      ],
    });
    return NextResponse.json({ result: JSON.parse(response.choices[0]?.message?.content || "{}") });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Win Theme 생성에 실패했습니다." }, { status: 500 });
  }
}
