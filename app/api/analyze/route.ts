import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 전시·체험시설 사업에 특화된 제안전략가이자 RFP 분석가다.
목표는 그럴듯한 문장을 쓰는 것이 아니라 발주문서의 사실과 요구사항을 정확히 구조화해 수주 제안전략의 근거를 만드는 것이다.
규칙:
1. 제공되지 않은 사실, 실적, 수치, 예산을 만들지 않는다.
2. FACT와 AI 해석을 구분한다.
3. 평가자가 확인하려는 질문을 생각한다.
4. 요구사항은 제안 대응방향까지 연결한다.
5. 결과는 반드시 유효한 JSON만 출력한다.`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const body = await request.json();
    const { mode, projectName, budget, area, rfpText } = body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const task = mode === "requirements"
      ? `요구사항을 추출하라. JSON 구조: {requirements:[{id,source_text,summary,type,mandatory,importance,ai_interpretation,proposal_response,evidence_needed}], missing_information:[]}. REQ-001부터 순서대로 ID를 부여한다.`
      : `사업을 분석하라. JSON 구조: {project_brief:{project_name,budget,area,purpose:[],core_tasks:[],target_users:[],constraints:[],risks:[],initial_proposal_directions:[]}, facts:[], ai_inferences:[], missing_information:[]}.`;

    const input = `프로젝트명: ${projectName || "미입력"}\n사업예산: ${budget || "미입력"}\n사업면적: ${area || "미입력"}\n\n[발주자료]\n${rfpText}\n\n[작업]\n${task}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: input },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    return NextResponse.json({ result: JSON.parse(text) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "AI 분석에 실패했습니다. 입력자료와 API 설정을 확인해주세요." }, { status: 500 });
  }
}
