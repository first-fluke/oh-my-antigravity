# Antigravity 멀티 에이전트 스킬

Google Antigravity IDE용 전문 에이전트 스킬 모음. PM, Frontend, Backend, Mobile, QA, Debug 전문 에이전트가 Agent Manager, CLI 기반 SubAgent Orchestrator, 실시간 Serena Memory 대시보드를 통해 협업합니다.

## 이게 뭔가요?

멀티 에이전트 협업 개발을 위한 **Antigravity Skills** 모음입니다. 작업을 전문 에이전트에게 분배합니다:

| 에이전트 | 전문 분야 |
|---------|----------|
| **Workflow Guide** | 복잡한 멀티 에이전트 프로젝트 조율 |
| **PM Agent** | 요구사항 분석, 태스크 분해, 아키텍처 설계 |
| **Frontend Agent** | React/Next.js, TypeScript, Tailwind CSS |
| **Backend Agent** | FastAPI, PostgreSQL, JWT 인증 |
| **Mobile Agent** | Flutter 크로스 플랫폼 개발 |
| **QA Agent** | OWASP Top 10 보안, 성능, 접근성 감사 |
| **Debug Agent** | 버그 진단, 근본 원인 분석, 회귀 테스트 |
| **Orchestrator** | CLI 기반 병렬 에이전트 실행 + Serena Memory |

## 빠른 시작

### 1. 클론 & 열기

```bash
git clone <repository-url>
cd subagent-orchestrator
antigravity open .
```

Antigravity가 `.agent/skills/`의 스킬을 자동 감지합니다.

### 2. 채팅으로 사용

**간단한 작업** (단일 에이전트 자동 활성화):
```
"Tailwind CSS로 로그인 폼 만들어줘"
→ frontend-agent 자동 활성화
```

**복잡한 프로젝트** (workflow-guide가 조율):
```
"사용자 인증이 있는 TODO 앱 만들어줘"
→ workflow-guide → PM Agent 기획 → Agent Manager에서 에이전트 생성
```

### 3. 대시보드로 모니터링

```bash
# 터미널 대시보드 (실시간)
npm run dashboard

# 웹 대시보드 (브라우저 UI)
npm run dashboard:web
# → http://localhost:9847
```

## 동작 원리

### Progressive Disclosure (점진적 공개)

스킬을 수동으로 선택할 필요 없습니다. Antigravity가 자동으로:
1. 채팅 요청을 분석
2. `.agent/skills/`의 스킬 설명과 매칭
3. 필요한 스킬만 컨텍스트에 로드
4. 지연 로딩으로 토큰 절약

### Agent Manager UI

복잡한 프로젝트에는 Antigravity **Agent Manager** (Mission Control)를 사용합니다:
1. PM Agent가 기획서 작성
2. Agent Manager UI에서 에이전트 생성
3. 에이전트들이 별도 워크스페이스에서 병렬 작업
4. 인박스 알림으로 진행 상황 확인
5. QA Agent가 최종 검토

### SubAgent Orchestrator (CLI)

프로그래밍 방식의 병렬 실행:

```bash
# 단일 에이전트
./scripts/spawn-subagent.sh backend "인증 API 구현" ./backend

# 병렬 에이전트
./scripts/spawn-subagent.sh backend "인증 API 구현" ./backend &
./scripts/spawn-subagent.sh frontend "로그인 폼 생성" ./frontend &
wait
```

지원 CLI: **Gemini**, **Claude**, **Codex**, **Qwen**

### Serena Memory 조율

Orchestrator가 `.serena/memories/`에 구조화된 상태를 기록합니다:

| 파일 | 용도 |
|------|------|
| `orchestrator-session.md` | 세션 ID, 상태, 단계 |
| `task-board.md` | 에이전트 할당 및 상태 테이블 |
| `progress-{agent}.md` | 에이전트별 턴 단위 진행 상황 |
| `result-{agent}.md` | 에이전트별 완료 결과 |

두 대시보드 모두 이 파일들을 감시하여 실시간 모니터링합니다.

## 실시간 대시보드

### 터미널 대시보드

```bash
npm run dashboard
# 또는 직접 실행:
scripts/dashboard.sh
```

`fswatch` (macOS) / `inotifywait` (Linux)로 `.serena/memories/`를 감시하고 실시간 상태 테이블을 표시합니다:

```
╔════════════════════════════════════════════════════════╗
║  Serena Memory Dashboard                              ║
║  Session: session-20260128-143022 [RUNNING]           ║
╠════════════════════════════════════════════════════════╣
║  Agent        Status        Turn   Task               ║
║  ──────────   ──────────    ────   ──────────         ║
║  backend      ● running      12   JWT Auth API        ║
║  frontend     ✓ completed    18   Login UI            ║
║  qa           ○ blocked       -   Security Review     ║
╠════════════════════════════════════════════════════════╣
║  Latest Activity:                                     ║
║  [backend] Turn 12 - Added tests and rate limit       ║
║  [frontend] Completed - All criteria met              ║
╠════════════════════════════════════════════════════════╣
║  Updated: 2026-01-28 14:32:05  |  Ctrl+C to exit     ║
╚════════════════════════════════════════════════════════╝
```

### 웹 대시보드

```bash
npm install        # 최초 1회 (chokidar, ws 설치)
npm run dashboard:web
# → http://localhost:9847
```

기능:
- WebSocket 실시간 푸시 (폴링 없음)
- 연결 끊김 시 자동 재연결
- 보라색 Serena 테마 UI
- 세션 상태, 에이전트 테이블, 활동 로그
- chokidar 기반 이벤트 드리븐 파일 감시 (크로스 플랫폼)

## 프로젝트 구조

```
.
├── .agent/
│   └── skills/
│       ├── workflow-guide/         # 멀티 에이전트 조율
│       ├── pm-agent/               # 프로덕트 매니저
│       ├── frontend-agent/         # React/Next.js
│       ├── backend-agent/          # FastAPI
│       ├── mobile-agent/           # Flutter
│       ├── qa-agent/               # 보안 & QA
│       ├── debug-agent/            # 버그 수정
│       └── orchestrator/           # CLI 기반 서브에이전트 실행
│           ├── scripts/
│           ├── config/cli-config.yaml
│           └── templates/
├── .serena/
│   └── memories/                   # 런타임 상태 (gitignore 처리됨)
├── scripts/
│   ├── dashboard.sh                # 터미널 대시보드
│   ├── dashboard-web/
│   │   ├── server.js               # 웹 대시보드 서버
│   │   └── public/index.html       # 웹 대시보드 UI
│   ├── spawn-subagent.sh           # 서브에이전트 실행기
│   └── poll-status.sh              # 상태 폴링
├── package.json
├── README.md                       # 영문 가이드
├── README-ko.md                    # 한글 가이드 (이 파일)
└── USAGE.md                        # 상세 사용 가이드
```

## 스킬 개요

### workflow-guide
**발동 조건**: 복잡한 멀티 도메인 요청
**역할**: PM, Frontend, Backend, Mobile, QA 에이전트 조율 안내

### pm-agent
**발동 조건**: "기획해줘", "분석해줘", "뭘 만들어야 할까"
**산출물**: `.agent/plan.json` (태스크, 우선순위, 의존성)

### frontend-agent
**발동 조건**: UI, 컴포넌트, 스타일링, 클라이언트 로직
**기술 스택**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui

### backend-agent
**발동 조건**: API, 데이터베이스, 인증
**기술 스택**: FastAPI, SQLAlchemy, PostgreSQL, Redis, JWT

### mobile-agent
**발동 조건**: 모바일 앱, iOS/Android
**기술 스택**: Flutter 3.19+, Dart, Riverpod

### qa-agent
**발동 조건**: "보안 검토해줘", "성능 확인", "감사해줘"
**검사 항목**: OWASP Top 10, Lighthouse, WCAG 2.1 AA

### debug-agent
**발동 조건**: 버그 리포트, 에러 메시지, 크래시
**산출물**: 수정된 코드, 회귀 테스트, 버그 문서

### orchestrator
**발동 조건**: 프로그래밍 방식의 서브에이전트 실행
**지원 CLI**: Gemini, Claude, Codex, Qwen (설정 가능)

## 사전 요구 사항

- **Google Antigravity** (2026+)
- **Node.js** (웹 대시보드용)
- **fswatch** (macOS) 또는 **inotify-tools** (Linux) — 터미널 대시보드용

SubAgent Orchestrator를 사용하려면 최소 1개의 CLI 도구 필요:

| CLI | 설치 | 인증 |
|-----|------|------|
| Gemini | `npm i -g @anthropic-ai/gemini-cli` | `gemini auth` |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude auth` |
| Codex | `npm i -g @openai/codex` | `codex auth` |
| Qwen | `pip install qwen-cli` | `qwen auth` |

## npm 스크립트

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `npm run dashboard` | `bash scripts/dashboard.sh` | 터미널 실시간 대시보드 |
| `npm run dashboard:web` | `node scripts/dashboard-web/server.js` | 웹 대시보드 (포트 9847) |
| `npm run validate` | `node scripts/validate-skills.js` | 스킬 파일 검증 |
| `npm run info` | `cat USAGE.md` | 사용 가이드 출력 |

## 문제 해결

### 대시보드에 "No agents detected" 표시
메모리 파일이 아직 생성되지 않았습니다. Orchestrator를 실행하거나 `.serena/memories/`에 수동으로 파일을 생성하세요.

### 웹 대시보드가 시작되지 않음
먼저 `npm install`로 `chokidar`와 `ws` 의존성을 설치하세요.

### 터미널 대시보드: "fswatch not found"
macOS: `brew install fswatch`
Linux: `apt install inotify-tools`

### Antigravity에서 스킬이 로드되지 않음
1. `antigravity open .`으로 프로젝트 열기
2. `.agent/skills/` 폴더와 `SKILL.md` 파일 확인
3. Antigravity IDE 재시작

### 에이전트 간 코드 불일치
1. `.gemini/antigravity/brain/`에서 산출물 검토
2. 다른 에이전트의 산출물을 참조하여 재생성
3. QA Agent로 최종 일관성 검사

## 라이선스

MIT

---

**Google Antigravity 2026용** | 참고: [README.md](./README.md) (English) | [USAGE.md](./USAGE.md) (상세 사용 가이드)
