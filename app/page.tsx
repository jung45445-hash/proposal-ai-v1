"use client";

import { useState } from "react";

type Mode = "project" | "requirements";

export default function Home() {
  const [projectName, setProjectName] = useState("");
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [rfpText, setRfpText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function analyze(mode: Mode) {
    if (!rfpText.trim()) {
      setResult("RFP 또는 과업지시서 내용을 입력해주세요.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, projectName, budget, area, rfpText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석 중 오류가 발생했습니다.");
      setResult(JSON.stringify(data.result, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PROPOSAL AI · PROTOTYPE 0</p>
          <h1>전시·체험사업 제안서 AI</h1>
          <p>RFP를 읽고 사업을 구조화한 뒤, 요구사항과 제안전략으로 연결하는 내부용 작업공간입니다.</p>
        </div>
        <span className="status">V0.1</span>
      </header>

      <section className="grid">
        <div className="panel">
          <h2>1. 프로젝트 기본정보</h2>
          <label>사업명<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="예: ○○ 어린이체험시설 조성사업" /></label>
          <div className="row">
            <label>사업예산<input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="예: 25억원" /></label>
            <label>사업면적<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 1,800㎡" /></label>
          </div>
          <label>RFP / 과업지시서 내용<textarea value={rfpText} onChange={(e) => setRfpText(e.target.value)} placeholder="우선 Prototype 0에서는 문서 내용을 붙여넣어 테스트합니다. 다음 단계에서 PDF/HWPX 업로드를 연결합니다." /></label>
          <div className="actions">
            <button disabled={loading} onClick={() => analyze("project")}>사업 분석</button>
            <button className="secondary" disabled={loading} onClick={() => analyze("requirements")}>요구사항 추출</button>
          </div>
        </div>

        <div className="panel output">
          <div className="outputHead"><h2>2. AI 분석 결과</h2>{loading && <span>분석 중…</span>}</div>
          {result ? <pre>{result}</pre> : <div className="empty">왼쪽에 사업정보와 RFP를 입력한 뒤 분석을 실행하세요.</div>}
        </div>
      </section>

      <section className="roadmap">
        <strong>다음 Workflow</strong>
        <span>RFP 분석</span><b>→</b><span>전략 인터뷰</span><b>→</b><span>Win Theme</span><b>→</b><span>Blueprint</span><b>→</b><span>Page Script</span>
      </section>
    </main>
  );
}
