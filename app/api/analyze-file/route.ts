import OpenAI from "openai";
import pdf from "pdf-parse";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `당신은 전시·체험시설 사업에 특화된 RFP 분석가다.
발주문서에서 사실과 요구사항을 정확히 추출하고 제안서 전략의 기초 데이터로 구조화한다.
제공되지 않은 사실, 수치, 실적은 만들지 않는다. FACT와 AI 해석을 구분한다.
문서 원문에 근거한 내용만 사실로 제시한다. 반드시 JSON만 출력한다.`;

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

    // 1) PDF를 Vercel 서버에서 직접 읽어 텍스트를 추출한다.
    // OpenAI Files 업로드 실패와 모델별 file-input 제약을 피하기 위한 안정화 경로다.
    let extractedText = "";
    let pageCount = 0;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await pdf(buffer);
      extractedText = (parsed.text || "").trim();
      pageCount = parsed.numpages || 0;
    } catch (parseError) {
      console.error("PDF parse error", parseError);
      return NextResponse.json({
        error: "PDF 텍스트 추출 단계에서 실패했습니다.",
        hint: "스캔본 PDF이거나 PDF 내부 구조가 특수할 수 있습니다. 다음 버전에서 이미지/스캔 페이지 분석 경로를 추가합니다.",
        stage: "PDF_TEXT_EXTRACTION",
      }, { status: 422 });
    }

    if (!extractedText) {
      return NextResponse.json({
        error: "PDF에서 읽을 수 있는 텍스트를 찾지 못했습니다.",
        hint: "이미지 스캔형 PDF일 수 있습니다. 이미지 분석 기능이 필요합니다.",
        stage: "PDF_TEXT_EXTRACTION",
      }, { status: 422 });
    }

    // V0.4 테스트에서는 과도한 토큰 사용을 막기 위해 최대 120,000자까지만 전달한다.
    // 이후 문서를 페이지/섹션 단위로 나눠 저장하는 파이프라인으로 교체할 예정이다.
    const sourceText = extractedText.slice(0, 120000);

    const task = mode === "requirements"
      ? `요구사항을 추출한다. 중요 요구사항을 누락하지 말고 가능한 한 구체적으로 분해한다. 출력 구조: {"requirements":[{"id":"REQ-001","source_excerpt":"","summary":"","type":"CONTENT|SPACE|DESIGN|MEDIA|OPERATION|SAFETY|MANAGEMENT|TECHNICAL|SCHEDULE|COST|OTHER","mandatory":true,"importance":"HIGH|MEDIUM|LOW","ai_interpretation":"","proposal_response":"","evidence_needed":[]}],"missing_information":[]}.`
      : `사업을 분석한다. 출력 구조: {"project_brief":{"project_name":"","budget":"","area":"","purpose":[],"core_tasks":[],"target_users":[],"spaces":[],"constraints":[],"risks":[],"initial_proposal_directions":[]},"facts":[{"fact":"","source_excerpt":""}],"ai_inferences":[],"missing_information":[]}.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions: SYSTEM,
      input: `프로젝트명: ${projectName}\n사업예산(사용자 입력): ${budget}\n사업면적(사용자 입력): ${area}\n파일명: ${file.name}\nPDF 페이지수: ${pageCount}\n\n[작업]\n${task}\n\n[PDF 추출 원문]\n${sourceText}`,
    });

    const text = response.output_text || "{}";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({
        error: "AI 응답은 받았지만 JSON 구조화에 실패했습니다.",
        hint: "모델 출력 형식을 조정해야 합니다.",
        detail: cleaned.slice(0, 1500),
        stage: "AI_OUTPUT_PARSE",
      }, { status: 502 });
    }

    return NextResponse.json({
      result,
      fileName: file.name,
      diagnostics: {
        stage: "SUCCESS",
        pdfPages: pageCount,
        extractedCharacters: extractedText.length,
        sentCharacters: sourceText.length,
        imageAnalysis: false,
      },
    });
  } catch (error: unknown) {
    console.error("PDF analysis error", error);
    const e = error as { status?: number; code?: string; type?: string; message?: string };
    let hint = "OpenAI API 설정과 사용 가능 모델을 확인해주세요.";
    if (e.status === 401) hint = "API 키 인증에 실패했습니다. Vercel의 OPENAI_API_KEY를 확인해주세요.";
    else if (e.status === 429) hint = "API 사용 한도 또는 결제 상태를 확인해주세요.";
    else if (e.status === 403) hint = "현재 API 프로젝트에서 해당 모델을 사용할 권한이 있는지 확인해주세요.";
    else if (e.status === 413) hint = "요청 크기가 허용 범위를 초과했습니다.";

    return NextResponse.json({
      error: "AI 분석 단계에서 실패했습니다.",
      hint,
      detail: e.message || e.code || e.type || "원인을 확인할 수 없습니다.",
      stage: "OPENAI_ANALYSIS",
    }, { status: typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500 });
  }
}
