import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 전시·체험시설 사업에 특화된 RFP 분석가다.
발주문서에서 사실과 요구사항을 정확히 추출하고 제안서 전략의 기초 데이터로 구조화한다.
제공되지 않은 사실, 수치, 실적은 만들지 않는다. FACT와 AI 해석을 구분한다.
반드시 JSON만 출력한다.`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "project");
    const projectName = String(formData.get("projectName") || "미입력");
    const budget = String(formData.get("budget") || "미입력");
    const area = String(formData.get("area") || "미입력");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "분석할 파일을 선택해주세요." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const uploaded = await openai.files.create({ file, purpose: "user_data" });

    const task = mode === "requirements"
      ? `요구사항을 추출한다. 출력 구조: {"requirements":[{"id":"REQ-001","summary":"","type":"","mandatory":true,"importance":"HIGH","ai_interpretation":"","proposal_response":"","evidence_needed":[]}],"missing_information":[]}.`
      : `사업을 분석한다. 출력 구조: {"project_brief":{"project_name":"","budget":"","area":"","purpose":[],"core_tasks":[],"target_users":[],"constraints":[],"risks":[],"initial_proposal_directions":[]},"facts":[],"ai_inferences":[],"missing_information":[]}.`;

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions: SYSTEM,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `프로젝트명: ${projectName}\n사업예산: ${budget}\n사업면적: ${area}\n\n${task}` },
          { type: "input_file", file_id: uploaded.id },
        ],
      }],
    });

    const text = response.output_text || "{}";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return NextResponse.json({ result: JSON.parse(cleaned), fileName: file.name });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "파일 분석에 실패했습니다. PDF 형식과 API 설정을 확인해주세요." }, { status: 500 });
  }
}
