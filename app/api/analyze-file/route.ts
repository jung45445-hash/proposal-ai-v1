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
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "현재 테스트 버전은 PDF 파일만 지원합니다." }, { status: 400 });
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
  } catch (error: unknown) {
    console.error("PDF analysis error", error);
    const e = error as { status?: number; code?: string; type?: string; message?: string };
    let hint = "PDF와 API 설정을 확인해주세요.";
    if (e.status === 401) hint = "API 키 인증에 실패했습니다. Vercel의 OPENAI_API_KEY를 확인해주세요.";
    else if (e.status === 429) hint = "API 사용 한도 또는 결제 상태를 확인해주세요.";
    else if (e.status === 403) hint = "현재 API 프로젝트에서 해당 모델/파일 기능을 사용할 권한이 있는지 확인해주세요.";
    else if (e.status === 413) hint = "PDF 파일이 현재 업로드 허용 크기보다 큽니다.";

    return NextResponse.json({
      error: "파일 분석에 실패했습니다.",
      hint,
      detail: e.message || e.code || e.type || "원인을 확인할 수 없습니다.",
    }, { status: typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500 });
  }
}
