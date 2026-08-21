"use client";

import { useState } from "react";

type Mode = "project" | "requirements";

type StrategyQuestion = {
  id: string;
  question: string;
  reason?: string;
  options?: string[];
};

export default function Home() {
  const [projectName, setProjectName] = useState("");
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [rfpText, setRfpText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [analysisContext, setAnalysisContext] = useState("");
  const [questions, setQuestions] = useState<StrategyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function analyze(mode: Mode) {
    if (!rfpText.trim() && !file) {
      setResult("RFP 텍스트를 입력하거나 PDF 파일을 선택해주세요.");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("mode", mode);
        form.append("projectName", projectName);
        form.append("budget", budget);
        form.append("area", area);
        response = await fetch("/api/analyze-file", { method: "POST", body: form });
      } else {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, projectName, budget, area, rfpText }),
        });
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "분석 중 오류가 발생했습니다.");
      const text = JSON.stringify(data.result, null, 2);
      setResult(text);
      setAnalysisContext(text);
      setQuestions([]);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function createStrategyInterview() {
    if (!analysisContext) {
      setResult("먼저 사업분석 또는 요구사항 추출을 실행해주세요.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, analysisContext }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "전략 인터뷰 생성에 실패했습니다.");
      setQuestions(data.result.questions || []);
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
          <p className="eyebrow">PROPOSAL AI · PROTOTYPE 0.2</p>
          <h1>전시·체험사업 제안서 AI</h1>
          <p>RFP를 분석하고 전략 인터뷰를 통해 제안서의 핵심 논리를 만드는 내부용 프로토타입입니다.</p>
        </div>
        <span className="status">V0.2</span>
      </header>

      <section className="grid">
        <div className="panel">
          <h2>1. 프로젝트와 발주자료</h2>
          <label>사업명<input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="예: ○○ 어린이체험시설 조성사업" /></label>
          <div className="row">
            <label>사업예산<input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="예: 25억원" /></label>
            <label>사업면적<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 1,800㎡" /></label>
          </div>
          <label>RFP / 과업지시서 PDF
            <input className="fileInput" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && <p className="fileName">선택 파일: {file.name}</p>}
          <label>또는 텍스트 입력<textarea value={rfpText} onChange={(e) => setRfpText(e.target.value)} placeholder="PDF가 없을 때 RFP 내용을 붙여넣을 수 있습니다." /></label>
          <div className="actions">
            <button disabled={loading} onClick={() => analyze("project")}>사업 분석</button>
            <button className="secondary" disabled={loading} onClick={() => analyze("requirements")}>요구사항 추출</button>
            <button className="accent" disabled={loading || !analysisContext} onClick={createStrategyInterview}>전략 인터뷰</button>
          </div>
        </div>

        <div className="panel output">
          <div className="outputHead"><h2>2. AI 분석 결과</h2>{loading && <span>분석 중…</span>}</div>
          {result ? <pre>{result}</pre> : <div className="empty">사업정보와 RFP를 입력한 뒤 분석을 실행하세요.</div>}
        </div>
      </section>

      {questions.length > 0 && (
        <section className="panel interview">
          <h2>3. 전략 인터뷰</h2>
          <p className="sectionDesc">AI가 자료에서 알 수 없는 전략적 선택만 질문합니다. 답변은 다음 단계의 Win Theme 생성에 사용됩니다.</p>
          {questions.map((q) => (
            <div className="question" key={q.id}>
              <strong>{q.id}. {q.question}</strong>
              {q.reason && <p>{q.reason}</p>}
              {q.options && q.options.length > 0 && <div className="chips">{q.options.map((option) => <button type="button" className="chip" key={option} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: option }))}>{option}</button>)}</div>}
              <textarea className="answer" value={answers[q.id] || ""} onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} placeholder="답변 또는 회사 내부 판단을 입력하세요." />
            </div>
          ))}
        </section>
      )}

      <section className="roadmap">
        <strong>Workflow</strong>
        <span className="done">RFP 분석</span><b>→</b><span className={questions.length ? "done" : ""}>전략 인터뷰</span><b>→</b><span>Win Theme</span><b>→</b><span>Blueprint</span><b>→</b><span>Page Script</span>
      </section>
    </main>
  );
}
