# Antigravity 멀티 에이전트 스킬

Google Antigravity IDE용 전문 에이전트 스킬 모음. PM, Frontend, Backend, Mobile, QA, Debug 전문 에이전트가 Agent Manager, CLI 기반 SubAgent Orchestrator, 실시간 Serena Memory 대시보드를 통해 협업합니다.

> **마음에 드셨나요?** 스타 눌러주세요!
> ```bash
> gh repo star first-fluke/oh-my-antigravity
> ```

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
| **Commit** | Conventional Commits 규칙 기반 커밋 관리 |

## 빠른 시작

### 1. 클론 & 열기

```bash
git clone <repository-url>
cd oh-my-antigravity
antigravity open .
```

Antigravity가 `.agent/skills/`의 스킬을 자동 감지합니다.

### 기존 프로젝트에 통합하기

이미 Antigravity 프로젝트가 있다면 스킬만 복사하면 됩니다:

```bash
# 옵션 1: 스킬만 복사
cp -r oh-my-antigravity/.agent/skills /path/to/your-project/.agent/

# 옵션 2: 스킬 + 대시보드
cp -r oh-my-antigravity/.agent/skills /path/to/your-project/.agent/
cp -r oh-my-antigravity/scripts/dashboard* /path/to/your-project/scripts/
cp oh-my-antigravity/package.json /path/to/your-project/  # 의존성 병합

# 옵션 3: 특정 스킬만
cp -r oh-my-antigravity/.agent/skills/backend-agent /path/to/your-project/.agent/skills/
cp -r oh-my-antigravity/.agent/skills/frontend-agent /path/to/your-project/.agent/skills/
```

본인 프로젝트에서:
```bash
cd /path/to/your-project
npm install  # 대시보드 사용할 경우
antigravity open .
```

모든 스킬이 이제 본인 프로젝트에서 사용 가능합니다!

### 2. 초기 설정 (선택)

```
/setup
→ CLI 설치 확인, MCP 연결 상태, 언어 및 CLI 매핑 설정
```

이 명령은 `.agent/config/user-preferences.yaml`을 생성합니다.

### 3. 채팅으로 사용

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

**명시적 조율** (유저가 워크플로우 호출):
```
/coordinate
→ 단계별: PM 기획 → 에이전트 생성 → QA 검토
```

**변경사항 커밋** (Conventional Commits):
```
/commit
→ 변경 분석, 커밋 타입/스코프 제안, Co-Author 포함 커밋 생성
```

### 3. 대시보드로 모니터링

```bash
bunx oh-my-antigravity dashboard      # 터미널 대시보드 (실시간)
bunx oh-my-antigravity dashboard:web  # 웹 대시보드 (브라우저 UI)
# → http://localhost:9847

# 또는 npm 스크립트 사용 (클론한 경우)
npm run dashboard      # 터미널 대시보드
npm run dashboard:web  # 웹 대시보드
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

### 멀티-CLI 설정

`.agent/config/user-preferences.yaml`에서 에이전트별 CLI 설정:

```yaml
# 응답 언어
language: ko  # ko, en, ja, zh, ...

# 기본 CLI (단일 작업)
default_cli: gemini

# 에이전트별 CLI 매핑 (멀티-CLI 모드)
agent_cli_mapping:
  frontend: gemini
  backend: codex
  mobile: gemini
  pm: claude
  qa: claude
  debug: gemini
```

**CLI 우선순위**:
1. `--vendor` 명령줄 인자
2. `user-preferences.yaml`의 `agent_cli_mapping`
3. `user-preferences.yaml`의 `default_cli`
4. `cli-config.yaml`의 `active_vendor` (레거시)
5. 하드코딩 기본값: `gemini`

대화형으로 설정하려면 `/setup` 실행.

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
│   ├── config/
│   │   └── user-preferences.yaml   # 언어, 타임존, CLI 매핑
│   ├── workflows/
│   │   ├── coordinate.md           # /coordinate (UI 기반 멀티 에이전트 조율)
│   │   ├── orchestrate.md          # /orchestrate (CLI 자동 병렬 실행)
│   │   ├── plan.md                 # /plan (PM 태스크 분해)
│   │   ├── review.md               # /review (전체 QA 파이프라인)
│   │   ├── debug.md                # /debug (구조화된 버그 수정)
│   │   ├── setup.md                # /setup (CLI & MCP 설정)
│   │   └── tools.md                # /tools (MCP 도구 관리)
│   └── skills/
│       ├── _shared/                    # 공통 리소스 (스킬 아님)
│       │   ├── serena-memory-protocol.md
│       │   ├── common-checklist.md
│       │   ├── skill-routing.md
│       │   ├── context-loading.md
│       │   ├── context-budget.md
│       │   ├── reasoning-templates.md
│       │   ├── clarification-protocol.md
│       │   ├── difficulty-guide.md
│       │   ├── lessons-learned.md
│       │   ├── verify.sh
│       │   └── api-contracts/
│       ├── workflow-guide/             # 멀티 에이전트 조율
│       ├── pm-agent/                   # 프로덕트 매니저
│       ├── frontend-agent/             # React/Next.js
│       ├── backend-agent/              # FastAPI
│       ├── mobile-agent/               # Flutter
│       ├── qa-agent/                   # 보안 & QA
│       ├── debug-agent/                # 버그 수정
│       ├── orchestrator/               # CLI 기반 서브에이전트 실행
│       └── commit/                     # Conventional Commits 스킬
│       # 각 스킬 구조:
│       #   SKILL.md              (~40줄, 토큰 최적화)
│       #   resources/
│       #     ├── execution-protocol.md  (Chain-of-thought 단계)
│       #     ├── examples.md            (Few-shot 입출력 예시)
│       #     ├── checklist.md           (셀프 검증)
│       #     ├── error-playbook.md      (장애 복구)
│       #     ├── tech-stack.md          (기술 스택 상세)
│       #     └── snippets.md           (코드 스니펫)
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

## 스킬 아키텍처

각 스킬은 **토큰 최적화된 2계층 설계**를 사용합니다:

- **SKILL.md** (~40줄): Antigravity가 즉시 로드. 스킬 정체성, 라우팅 조건, 핵심 규칙만 포함.
- **resources/**: 필요 시 로드. 실행 프로토콜, few-shot 예시, 체크리스트, 에러 플레이북, 코드 스니펫, 기술 스택 상세 포함.

이를 통해 초기 스킬 로딩 시 **~75% 토큰 절약** (스킬당 3-7KB → ~800B).

### 공통 리소스 (`_shared/`)

모든 스킬에서 중복 제거된 공통 리소스:

| 리소스 | 용도 |
|--------|------|
| `reasoning-templates.md` | 다단계 추론을 위한 구조화된 빈칸 채우기 템플릿 |
| `clarification-protocol.md` | 질문 vs 가정 판단, 모호성 수준별 대응 |
| `context-budget.md` | 모델 등급별 토큰 효율적 파일 읽기 전략 |
| `context-loading.md` | Orchestrator 프롬프트 구성을 위한 태스크-리소스 매핑 |
| `skill-routing.md` | 키워드→스킬 매핑, 병렬 실행 규칙 |
| `difficulty-guide.md` | Simple/Medium/Complex 평가 및 프로토콜 분기 |
| `lessons-learned.md` | 크로스 세션 누적 도메인 교훈 |
| `verify.sh` | 에이전트 완료 후 자동 검증 스크립트 |
| `api-contracts/` | PM이 작성, Backend가 구현, Frontend/Mobile이 소비 |
| `serena-memory-protocol.md` | CLI 모드 메모리 읽기/쓰기 프로토콜 |
| `common-checklist.md` | 범용 코드 품질 체크리스트 |

### 스킬별 리소스

각 스킬이 도메인 특화 리소스를 제공:

| 리소스 | 용도 |
|--------|------|
| `execution-protocol.md` | 4단계 Chain-of-thought 워크플로우 (분석 → 설계 → 구현 → 검증) |
| `examples.md` | 2-3개 few-shot 입출력 예시 |
| `checklist.md` | 도메인별 셀프 검증 체크리스트 |
| `error-playbook.md` | "3 strikes" 에스컬레이션 규칙을 포함한 장애 복구 |
| `tech-stack.md` | 상세 기술 사양 |
| `snippets.md` | 바로 사용 가능한 코드 패턴 |

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

### commit
**발동 조건**: "커밋해줘", "commit", "변경사항 저장"
**형식**: Conventional Commits + Co-Author 태그
**설정**: `.agent/skills/commit/config/commit-config.yaml`

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

## 문서

| 문서 | 대상 | 용도 |
|------|------|------|
| [README.md](./README.md) | 사용자 | 프로젝트 개요 (영문) |
| [README-ko.md](./README-ko.md) | 사용자 | 프로젝트 개요 (한글) |
| [USAGE.md](./USAGE.md) | 사용자 | 스킬 사용 방법 (영문) |
| [USAGE-ko.md](./USAGE-ko.md) | 사용자 | 스킬 사용 방법 (한글) |
| [AGENT_GUIDE.md](./AGENT_GUIDE.md) | 개발자 | **기존 프로젝트에 통합하는 방법** |

---

**Google Antigravity 2026용** | **처음이신가요?** [AGENT_GUIDE.md](./AGENT_GUIDE.md)에서 기존 프로젝트에 통합하는 방법을 확인하세요
