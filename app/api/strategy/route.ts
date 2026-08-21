import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 전시·체험사업 제안전략가다.
사용자에게 이미 확보된 사업분석과 요구사항을 반복해서 묻지 말고, AI만으로 결정하기 어려운 전략 선택만 인터뷰한다.
질문은 전시·체험사업의 콘텐츠 차별성, 공간경험, 운영, 예산 우선순위, 대표 콘텐츠, 회사실적 활용 관점에서 만든다.
한 번에 5~8개만 제시하고, 각 질문에는 왜 필요한지 reason을 붙인다. 반드시 JSON만 출력한다.`;

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
    const response = await openai.responses.create({
      model: process.env.OPENAI_STRATEGY_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-terra",
      instructions: SYSTEM,
      input: `프로젝트: ${projectName || "미입력"}\n\n현재 분석 데이터:\n${analysisContext}\n\n출력 구조: {"questions":[{"id":"Q1","question":"","reason":"","options":[]}],"strategy_focus_candidates":[]}`,
    });

    const text = response.output_text || "{}";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return NextResponse.json({ result: JSON.parse(cleaned) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "전략 인터뷰 생성에 실패했습니다." }, { status: 500 });
  }
}
