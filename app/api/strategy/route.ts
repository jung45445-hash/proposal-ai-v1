import OpenAI from "openai";
import { NextResponse } from "next/server";

const SYSTEM = `당신은 공공 전시·체험사업 전문 제안전략가다.
목표는 일반적인 아이디어 나열이 아니라 발주처 의도, 지역성, 장소성, 사업예산, 공간조건, 운영조건을 결합해 실제 심사에서 기억될 전략 선택을 돕는 것이다.

중요 규칙:
1. 제한경쟁입찰의 참가자격·면허·회사규모·회사명·고유실적·인력 등 업체를 특정할 수 있는 정보는 전략 질문이나 차별화 근거로 사용하지 않는다. 블라인드/공정성 원칙을 우선한다.
2. 이미 RFP에서 확인된 사실을 다시 질문하지 않는다. AI만으로 결정하기 어려운 '선택'만 묻는다.
3. 질문은 사업특화성이 높은 순서로 5~7개만 만든다: 발주처 핵심의도, 지역/장소 정체성, 메인 컨셉, 공간경험, 대표 콘텐츠, 기술 적용수준, 예산 선택집중, 실행/운영 리스크.
4. 특히 지방자치단체 사업은 지역의 역사·산업·문화·자연·도시이미지·정책방향·장소성을 컨셉으로 발전시킬 수 있도록 질문한다. 단, 현재 제공된 자료에 없는 지역정보를 사실처럼 만들어내지 말고 '추가 리서치 필요'로 표시한다.
5. '혁신·미래·소통·융합'처럼 어느 지역에도 적용 가능한 상투적 표현은 피한다. 다른 지자체 이름으로 바꿔도 성립하는 전략은 낮게 평가한다.
6. 사용자의 선택을 무조건 긍정하지 않는다. RFP 충돌, 단순 연대기화, 과도한 미디어 의존, 유지관리 부담, 예산 과투자, 장소성 부족 가능성이 있으면 reason 또는 risk에 명시한다.
7. 전략 후보는 단순 슬로건이 아니라 '왜 이 사업에서만 성립하는지'가 드러나게 만든다.
8. 각 전략 후보에 distinctiveness(차별성), locality(지역특화성), feasibility(실행가능성)를 high/medium/low로 평가하고 risk를 한 문장으로 쓴다.
9. 회사 관련 질문은 생성하지 않는다.
10. 반드시 JSON만 출력한다.`;

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
      input: `프로젝트: ${projectName || "미입력"}\n\n현재 RFP/사업 분석 데이터:\n${analysisContext}\n\n전략 인터뷰를 생성하라. 자료만으로 지역·발주처 DNA를 충분히 판단할 수 없으면 억지로 채우지 말고 research_needed에 필요한 조사주제를 적어라.\n\n출력 구조:\n{"questions":[{"id":"Q1","question":"","reason":"","options":[]}],"strategy_focus_candidates":[{"name":"","logic":"","distinctiveness":"high|medium|low","locality":"high|medium|low","feasibility":"high|medium|low","risk":""}],"research_needed":[]}`,
    });

    const text = response.output_text || "{}";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return NextResponse.json({ result: JSON.parse(cleaned) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "전략 인터뷰 생성에 실패했습니다." }, { status: 500 });
  }
}
