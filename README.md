# Proposal AI V1

전시·체험사업 제안서 작성을 위한 자체 개발 프로토타입입니다.

## Prototype 0

- 프로젝트 기본정보 입력
- RFP/과업지시서 텍스트 입력
- OpenAI API 기반 사업 분석
- 요구사항 추출
- 이후 전략 인터뷰, Win Theme, Proposal Blueprint, Page Script로 확장

## 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 `OPENAI_API_KEY`를 설정하세요.
