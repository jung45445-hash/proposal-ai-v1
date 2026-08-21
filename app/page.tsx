"use client";

import { useState } from "react";

type Mode = "project" | "requirements";
type StrategyQuestion = { id: string; question: string; reason?: string; options?: string[] };
type Theme = { id: string; name: string; statement: string; customer_reason?: string; differentiation?: string; evidence_gap?: string[] };
type Claim = { id: string; claim: string; customer_benefit?: string; priority?: string };
type MatrixRow = { requirement_id: string; requirement: string; evaluation?: string; response_strategy?: string; recommended_section?: string; coverage?: string; gap?: string };
type Section = { section_id: string; section_name: string; section_objective?: string; evaluator_question?: string; main_message: string; supporting_messages?: string[]; evidence_needed?: string[]; recommended_pages?: number };

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
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);

  async function analyze(mode: Mode) {
    if (!rfpText.trim() && !file) { setResult("RFP 텍스트를 입력하거나 PDF 파일을 선택해주세요."); return; }
    setLoading(true); setResult("");
    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.append("file", file); form.append("mode", mode); form.append("projectName", projectName); form.append("budget", budget); form.append("area", area);
        response = await fetch("/api/analyze-file", { method: "POST", body: form });
      } else {
        response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, projectName, budget, area, rfpText }) });
      }
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "분석 중 오류가 발생했습니다.");
      const text = JSON.stringify(data.result, null, 2); setResult(text); setAnalysisContext(text); setQuestions([]); setThemes([]); setClaims([]); setMatrix([]); setSections([]);
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); } finally { setLoading(false); }
  }

  async function createStrategyInterview() {
    if (!analysisContext) { setResult("먼저 사업분석 또는 요구사항 추출을 실행해주세요."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "전략 인터뷰 생성에 실패했습니다.");
      setQuestions(data.result.questions || []); setResult(JSON.stringify(data.result, null, 2));
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); } finally { setLoading(false); }
  }

  async function createWinThemes() {
    if (!questions.length) return;
    setLoading(true);
    try {
      const response = await fetch("/api/win-theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext, questions, answers }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Win Theme 생성에 실패했습니다.");
      setThemes(data.result.themes || []); setSelectedTheme(data.result.recommended_theme_id || ""); setResult(JSON.stringify(data.result, null, 2));
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); } finally { setLoading(false); }
  }

  async function createSectionMessages() {
    if (!selectedTheme) return;
    setLoading(true);
    try {
      const response = await fetch("/api/section-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext, questions, answers, selectedTheme, themes }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Section Message 생성에 실패했습니다.");
      setClaims(data.result.claims || []); setMatrix(data.result.requirement_matrix || []); setSections(data.result.sections || []); setResult(JSON.stringify(data.result, null, 2));
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); } finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="hero"><div><p className="eyebrow">PROPOSAL AI · PROTOTYPE 0.4</p><h1>전시·체험사업 제안서 AI</h1><p>RFP 분석부터 전략, 요구사항 조견표, 섹션 메시지까지 연결해 실제 제안 논리를 검토합니다.</p></div><span className="status">V0.4</span></header>
    <section className="grid">
      <div className="panel"><h2>1. 프로젝트와 발주자료</h2>
        <label>사업명<input value={projectName} onChange={(e)=>setProjectName(e.target.value)} placeholder="예: ○○ 어린이체험시설 조성사업" /></label>
        <div className="row"><label>사업예산<input value={budget} onChange={(e)=>setBudget(e.target.value)} placeholder="예: 25억원" /></label><label>사업면적<input value={area} onChange={(e)=>setArea(e.target.value)} placeholder="예: 1,800㎡" /></label></div>
        <label>RFP / 과업지시서 PDF<input className="fileInput" type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0]||null)} /></label>{file&&<p className="fileName">선택 파일: {file.name}</p>}
        <label>또는 텍스트 입력<textarea value={rfpText} onChange={(e)=>setRfpText(e.target.value)} placeholder="PDF가 없을 때 RFP 내용을 붙여넣을 수 있습니다." /></label>
        <div className="actions"><button disabled={loading} onClick={()=>analyze("project")}>사업 분석</button><button className="secondary" disabled={loading} onClick={()=>analyze("requirements")}>요구사항 추출</button><button className="accent" disabled={loading||!analysisContext} onClick={createStrategyInterview}>전략 인터뷰</button></div>
      </div>
      <div className="panel output"><div className="outputHead"><h2>2. AI 작업 결과</h2>{loading&&<span>분석 중…</span>}</div>{result?<pre>{result}</pre>:<div className="empty">사업정보와 RFP를 입력한 뒤 분석을 실행하세요.</div>}</div>
    </section>

    {questions.length>0&&<section className="panel interview"><h2>3. 전략 인터뷰</h2><p className="sectionDesc">AI가 자료에서 알 수 없는 전략적 선택만 질문합니다.</p>{questions.map(q=><div className="question" key={q.id}><strong>{q.id}. {q.question}</strong>{q.reason&&<p>{q.reason}</p>}{q.options?.length?<div className="chips">{q.options.map(o=><button type="button" className="chip" key={o} onClick={()=>setAnswers(p=>({...p,[q.id]:o}))}>{o}</button>)}</div>:null}<textarea className="answer" value={answers[q.id]||""} onChange={(e)=>setAnswers(p=>({...p,[q.id]:e.target.value}))} placeholder="답변 또는 회사 내부 판단을 입력하세요." /></div>)}<button className="accent" disabled={loading} onClick={createWinThemes}>Win Theme 생성</button></section>}

    {themes.length>0&&<section className="panel interview"><h2>4. Win Theme 후보</h2><div className="themeGrid">{themes.map(t=><button type="button" key={t.id} className={`themeCard ${selectedTheme===t.id?"selected":""}`} onClick={()=>setSelectedTheme(t.id)}><small>{t.id}</small><strong>{t.name}</strong><span>{t.statement}</span>{t.differentiation&&<em>차별화: {t.differentiation}</em>}{t.evidence_gap?.length?<em>보완 필요: {t.evidence_gap.join(", ")}</em>:null}</button>)}</div><p className="selectedNote">선택된 Theme: <strong>{selectedTheme||"미선택"}</strong></p><button className="accent" disabled={loading||!selectedTheme} onClick={createSectionMessages}>Claim · 조견표 · 섹션 메시지 생성</button></section>}

    {claims.length>0&&<section className="panel interview"><h2>5. 핵심 Claim</h2><div className="messageGrid">{claims.map(c=><article className="messageCard" key={c.id}><small>{c.id} · {c.priority}</small><strong>{c.claim}</strong>{c.customer_benefit&&<p>{c.customer_benefit}</p>}</article>)}</div></section>}

    {matrix.length>0&&<section className="panel interview"><h2>6. 요구사항 조견표</h2><div className="tableWrap"><table><thead><tr><th>REQ</th><th>요구사항</th><th>평가/전략</th><th>권장 섹션</th><th>대응</th></tr></thead><tbody>{matrix.map((m,i)=><tr key={m.requirement_id||i}><td>{m.requirement_id}</td><td>{m.requirement}</td><td><strong>{m.evaluation}</strong><br/>{m.response_strategy}</td><td>{m.recommended_section}</td><td><span className={`coverage ${(m.coverage||"").toLowerCase()}`}>{m.coverage}</span>{m.gap&&<small>{m.gap}</small>}</td></tr>)}</tbody></table></div></section>}

    {sections.length>0&&<section className="panel interview"><h2>7. Section Message</h2><p className="sectionDesc">여기부터 실제 제안서의 내용 품질을 판단할 수 있습니다.</p><div className="sectionGrid">{sections.map(s=><article className="sectionCard" key={s.section_id}><div className="sectionTop"><small>{s.section_id}</small><span>{s.recommended_pages||0}P 권장</span></div><h3>{s.section_name}</h3><p className="objective">목적 · {s.section_objective}</p><p className="evaluator">평가위원 질문 · {s.evaluator_question}</p><strong className="mainMessage">{s.main_message}</strong>{s.supporting_messages?.length?<ul>{s.supporting_messages.map((m,i)=><li key={i}>{m}</li>)}</ul>:null}{s.evidence_needed?.length?<p className="evidence">필요 Evidence · {s.evidence_needed.join(" / ")}</p>:null}</article>)}</div></section>}

    <section className="roadmap"><strong>Workflow</strong><span className="done">RFP 분석</span><b>→</b><span className={questions.length?"done":""}>전략 인터뷰</span><b>→</b><span className={themes.length?"done":""}>Win Theme</span><b>→</b><span className={matrix.length?"done":""}>요구사항 조견표</span><b>→</b><span className={sections.length?"done":""}>Section Message</span><b>→</b><span>Blueprint</span></section>
  </main>;
}
