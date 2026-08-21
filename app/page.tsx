"use client";

import { useEffect, useState } from "react";

type Mode = "project" | "requirements";
type Project = { id: number; project_name: string; budget?: number | null; area?: number | null; status?: string };
type StrategyQuestion = { id: string; question: string; reason?: string; options?: string[] };
type Theme = { id: string; name: string; statement: string; customer_reason?: string; differentiation?: string; evidence_gap?: string[] };
type Claim = { id: string; claim: string; customer_benefit?: string; priority?: string };
type MatrixRow = { requirement_id: string; requirement: string; evaluation?: string; response_strategy?: string; recommended_section?: string; coverage?: string; gap?: string };
type Section = { section_id: string; section_name: string; section_objective?: string; evaluator_question?: string; main_message: string; supporting_messages?: string[]; evidence_needed?: string[]; recommended_pages?: number };

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
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
  const [saveStatus, setSaveStatus] = useState("DB 연결 확인 중…");

  useEffect(() => { void refreshProjects(); }, []);

  async function refreshProjects() {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "프로젝트 목록 오류");
      setProjects(data.projects || []);
      setSaveStatus("프로젝트 DB 연결됨");
    } catch {
      setSaveStatus("DB 연결 확인 필요");
    }
  }

  function resetWorkspace() {
    setProjectId(null); setProjectName(""); setBudget(""); setArea(""); setRfpText(""); setFile(null);
    setResult(""); setAnalysisContext(""); setQuestions([]); setAnswers({}); setThemes([]); setSelectedTheme(""); setClaims([]); setMatrix([]); setSections([]);
    setSaveStatus("새 프로젝트");
  }

  async function ensureProject() {
    if (projectId) return projectId;
    if (!projectName.trim()) throw new Error("사업명을 먼저 입력해주세요.");
    const response = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, budget, area }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "프로젝트 생성 실패");
    const id = Number(data.project.id);
    setProjectId(id); setSaveStatus(`프로젝트 #${id} 저장됨`); await refreshProjects();
    return id;
  }

  async function saveStage(id: number, analysisType: string, payload: unknown) {
    try {
      const response = await fetch("/api/project-state", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id, analysisType, result: payload }),
      });
      if (!response.ok) throw new Error();
      setSaveStatus(`자동 저장 완료 · ${analysisType}`);
      void refreshProjects();
    } catch {
      setSaveStatus("자동 저장 실패 · 화면 결과는 유지됨");
    }
  }

  async function loadProject(id: number) {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "프로젝트 불러오기 실패");
      setProjectId(id); setProjectName(data.project.project_name || ""); setBudget(data.project.budget ? String(data.project.budget) : ""); setArea(data.project.area ? String(data.project.area) : "");
      const latest = data.latest || {};
      const base = latest.project_analysis || latest.requirements || null;
      if (base) { const text = JSON.stringify(base, null, 2); setAnalysisContext(text); setResult(text); }
      const interview = latest.strategy_interview as { questions?: StrategyQuestion[] } | undefined;
      if (interview?.questions) setQuestions(interview.questions);
      const wt = latest.win_theme as { themes?: Theme[]; recommended_theme_id?: string } | undefined;
      if (wt?.themes) { setThemes(wt.themes); setSelectedTheme(wt.recommended_theme_id || ""); }
      const sm = latest.section_message as { claims?: Claim[]; requirement_matrix?: MatrixRow[]; sections?: Section[] } | undefined;
      if (sm) { setClaims(sm.claims || []); setMatrix(sm.requirement_matrix || []); setSections(sm.sections || []); }
      setSaveStatus(`프로젝트 #${id} 불러옴`);
    } catch (error) { setResult(error instanceof Error ? error.message : "프로젝트 불러오기 실패"); }
    finally { setLoading(false); }
  }

  async function analyze(mode: Mode) {
    if (!rfpText.trim() && !file) { setResult("RFP 텍스트를 입력하거나 PDF 파일을 선택해주세요."); return; }
    setLoading(true); setResult("");
    try {
      const id = await ensureProject();
      let response: Response;
      if (file) {
        const form = new FormData(); form.append("file", file); form.append("mode", mode); form.append("projectName", projectName); form.append("budget", budget); form.append("area", area);
        response = await fetch("/api/analyze-file", { method: "POST", body: form });
      } else {
        response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, projectName, budget, area, rfpText }) });
      }
      const data = await response.json();
      if (!response.ok) { const parts = [data.error, data.hint, data.detail].filter(Boolean); throw new Error(parts.join("\n\n")); }
      const text = JSON.stringify(data.result, null, 2); setResult(text); setAnalysisContext(text); setQuestions([]); setThemes([]); setClaims([]); setMatrix([]); setSections([]);
      await saveStage(id, mode === "project" ? "project_analysis" : "requirements", data.result);
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  async function createStrategyInterview() {
    if (!analysisContext) { setResult("먼저 사업분석 또는 요구사항 추출을 실행해주세요."); return; }
    setLoading(true);
    try {
      const id = await ensureProject();
      const response = await fetch("/api/strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "전략 인터뷰 생성에 실패했습니다.");
      setQuestions(data.result.questions || []); setResult(JSON.stringify(data.result, null, 2)); await saveStage(id, "strategy_interview", data.result);
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  async function createWinThemes() {
    if (!questions.length) return; setLoading(true);
    try {
      const id = await ensureProject();
      const response = await fetch("/api/win-theme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext, questions, answers }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Win Theme 생성에 실패했습니다.");
      setThemes(data.result.themes || []); setSelectedTheme(data.result.recommended_theme_id || ""); setResult(JSON.stringify(data.result, null, 2));
      await saveStage(id, "win_theme", { ...data.result, interview_answers: answers });
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  async function createSectionMessages() {
    if (!selectedTheme) return; setLoading(true);
    try {
      const id = await ensureProject();
      const response = await fetch("/api/section-message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectName, analysisContext, questions, answers, selectedTheme, themes }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Section Message 생성에 실패했습니다.");
      setClaims(data.result.claims || []); setMatrix(data.result.requirement_matrix || []); setSections(data.result.sections || []); setResult(JSON.stringify(data.result, null, 2));
      await saveStage(id, "section_message", data.result);
    } catch (error) { setResult(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="hero"><div><p className="eyebrow">PROPOSAL AI · PROTOTYPE 0.5</p><h1>전시·체험사업 제안서 AI</h1><p>프로젝트 단위로 RFP 분석부터 전략·메시지까지 누적 저장합니다.</p></div><span className="status">V0.5</span></header>

    <section className="panel interview">
      <div className="outputHead"><h2>프로젝트</h2><span>{saveStatus}</span></div>
      <div className="actions"><button onClick={resetWorkspace}>+ 새 프로젝트</button>{projects.slice(0, 8).map(p => <button key={p.id} className={projectId === p.id ? "accent" : "secondary"} onClick={() => void loadProject(p.id)}>{p.project_name}</button>)}</div>
    </section>

    <section className="grid">
      <div className="panel"><h2>1. 프로젝트와 발주자료 {projectId ? <small>· DB #{projectId}</small> : null}</h2>
        <label>사업명<input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="예: ○○ 역사문화관 전시설계 및 제작설치" /></label>
        <div className="row"><label>사업예산<input value={budget} onChange={e => setBudget(e.target.value)} /></label><label>사업면적<input value={area} onChange={e => setArea(e.target.value)} /></label></div>
        <label>RFP / 과업지시서 PDF<input className="fileInput" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>{file && <p className="fileName">선택 파일: {file.name}</p>}
        <label>또는 텍스트 입력<textarea value={rfpText} onChange={e => setRfpText(e.target.value)} placeholder="PDF가 없을 때 RFP 내용을 붙여넣을 수 있습니다." /></label>
        <div className="actions"><button disabled={loading} onClick={() => void analyze("project")}>사업 분석</button><button className="secondary" disabled={loading} onClick={() => void analyze("requirements")}>요구사항 추출</button><button className="accent" disabled={loading || !analysisContext} onClick={() => void createStrategyInterview()}>전략 인터뷰</button></div>
      </div>
      <div className="panel output"><div className="outputHead"><h2>2. AI 작업 결과</h2>{loading && <span>작업 중…</span>}</div>{result ? <pre>{result}</pre> : <div className="empty">프로젝트를 만들고 RFP 분석을 시작하세요. 결과는 자동 저장됩니다.</div>}</div>
    </section>

    {questions.length > 0 && <section className="panel interview"><h2>3. 전략 인터뷰</h2>{questions.map(q => <div className="question" key={q.id}><strong>{q.id}. {q.question}</strong>{q.reason && <p>{q.reason}</p>}{q.options?.length ? <div className="chips">{q.options.map(o => <button type="button" className="chip" key={o} onClick={() => setAnswers(p => ({ ...p, [q.id]: o }))}>{o}</button>)}</div> : null}<textarea className="answer" value={answers[q.id] || ""} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} placeholder="답변 또는 내부 판단" /></div>)}<button className="accent" disabled={loading} onClick={() => void createWinThemes()}>Win Theme 생성</button></section>}

    {themes.length > 0 && <section className="panel interview"><h2>4. Win Theme 후보</h2><div className="themeGrid">{themes.map(t => <button type="button" key={t.id} className={`themeCard ${selectedTheme === t.id ? "selected" : ""}`} onClick={() => setSelectedTheme(t.id)}><small>{t.id}</small><strong>{t.name}</strong><span>{t.statement}</span></button>)}</div><button className="accent" disabled={loading || !selectedTheme} onClick={() => void createSectionMessages()}>Claim · 조견표 · 섹션 메시지 생성</button></section>}
    {claims.length > 0 && <section className="panel interview"><h2>5. 핵심 Claim</h2><div className="messageGrid">{claims.map(c => <article className="messageCard" key={c.id}><small>{c.id} · {c.priority}</small><strong>{c.claim}</strong><p>{c.customer_benefit}</p></article>)}</div></section>}
    {matrix.length > 0 && <section className="panel interview"><h2>6. 요구사항 조견표</h2><div className="tableWrap"><table><thead><tr><th>REQ</th><th>요구사항</th><th>평가/전략</th><th>권장 섹션</th><th>대응</th></tr></thead><tbody>{matrix.map((m, i) => <tr key={m.requirement_id || i}><td>{m.requirement_id}</td><td>{m.requirement}</td><td>{m.response_strategy}</td><td>{m.recommended_section}</td><td>{m.coverage}</td></tr>)}</tbody></table></div></section>}
    {sections.length > 0 && <section className="panel interview"><h2>7. Section Message</h2><div className="sectionGrid">{sections.map(s => <article className="sectionCard" key={s.section_id}><h3>{s.section_name}</h3><p>{s.section_objective}</p><strong>{s.main_message}</strong></article>)}</div></section>}

    <section className="roadmap"><strong>Workflow</strong><span className="done">프로젝트 DB</span><b>→</b><span className={analysisContext ? "done" : ""}>RFP 분석</span><b>→</b><span className={questions.length ? "done" : ""}>전략 인터뷰</span><b>→</b><span className={themes.length ? "done" : ""}>Win Theme</span><b>→</b><span className={sections.length ? "done" : ""}>Section Message</span><b>→</b><span>자동 리서치</span><b>→</b><span>Concept / 예산</span><b>→</b><span>Blueprint</span></section>
  </main>;
}
