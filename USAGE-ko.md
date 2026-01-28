# Antigravity 멀티 에이전트 스킬 사용 가이드

## 빠른 시작

1. **Antigravity IDE에서 열기**
   ```bash
   antigravity open /path/to/subagent-orchestrator
   ```

2. **스킬이 자동으로 감지됩니다.** Antigravity가 `.agent/skills/`를 스캔하여 모든 스킬을 인덱싱합니다.

3. **IDE에서 채팅하세요.** 만들고 싶은 것을 설명하면 됩니다.

---

## 사용 예시

### 예시 1: 간단한 단일 도메인 작업

**입력:**
```
"Tailwind CSS로 이메일, 비밀번호 필드가 있는 로그인 폼 만들어줘"
```

**결과:**
- Antigravity가 `frontend-agent` 매칭
- 자동으로 스킬 로드 (Progressive Disclosure)
- TypeScript, Tailwind, 폼 검증이 있는 React 컴포넌트 받음

### 예시 2: 복잡한 멀티 도메인 프로젝트

**입력:**
```
"사용자 인증이 있는 TODO 앱 만들어줘"
```

**결과:**

1. **Workflow Guide 활성화** — 멀티 도메인 복잡도 감지
2. **PM Agent 기획** — 우선순위와 함께 태스크 분해
3. **Agent Manager에서 에이전트 생성**:
   - Backend Agent: JWT 인증 API
   - Frontend Agent: 로그인 및 TODO UI
4. **에이전트들이 병렬 작업** — Knowledge Base에 저장
5. **조율** — `.gemini/antigravity/brain/` 일관성 확인
6. **QA Agent 검토** — 보안/성능 감사
7. **수정 & 반복** — 필요시 에이전트 재생성

### 예시 3: 버그 수정

**입력:**
```
"로그인 버튼 클릭하면 'Cannot read property map of undefined' 에러 나요"
```

**결과:**

1. **debug-agent 활성화** — 에러 분석
2. **근본 원인 발견** — `todos` 데이터 로드 전에 map 시도
3. **수정 제공** — 로딩, 에러, 빈 상태 추가
4. **회귀 테스트 작성** — 버그 재발 방지
5. **유사 패턴 발견** — 다른 3개 컴포넌트도 사전 수정

### 예시 4: CLI 기반 병렬 실행

```bash
# 단일 에이전트
./scripts/spawn-subagent.sh backend "JWT 인증 API 구현" ./backend

# 병렬 에이전트
./scripts/spawn-subagent.sh backend "인증 API 구현" ./backend &
./scripts/spawn-subagent.sh frontend "로그인 폼 생성" ./frontend &
./scripts/spawn-subagent.sh mobile "인증 화면 구축" ./mobile &
wait
```

**실시간 모니터링:**
```bash
# 터미널 (별도 창)
npm run dashboard

# 또는 브라우저
npm run dashboard:web
# → http://localhost:9847
```

---

## 실시간 대시보드

### 터미널 대시보드

```bash
npm run dashboard
```

`fswatch` (macOS) 또는 `inotifywait` (Linux)로 `.serena/memories/`를 감시합니다. 세션 상태, 에이전트 상태, 턴 수, 최신 활동을 실시간 테이블로 표시합니다. 메모리 파일 변경 시 자동으로 업데이트됩니다.

**요구 사항:**
- macOS: `brew install fswatch`
- Linux: `apt install inotify-tools`

### 웹 대시보드

```bash
npm install          # 최초 1회
npm run dashboard:web
```

브라우저에서 `http://localhost:9847` 열기. 기능:

- **WebSocket 실시간 업데이트** (폴링 아님)
- **자동 재연결** — 연결 끊어지면 자동 복구
- **Serena 테마 UI** — 보라색 강조
- **세션 상태** — ID와 실행/완료/실패 상태
- **에이전트 테이블** — 이름, 상태 (컬러 도트), 턴 수, 태스크 설명
- **활동 로그** — progress 및 result 파일의 최신 변경 사항

서버는 chokidar로 `.serena/memories/`를 감시하며 debounce (100ms)를 적용합니다. 변경된 파일만 읽으므로 — 전체 재스캔 없음.

---

## 핵심 개념

### Progressive Disclosure (점진적 공개)
Antigravity가 자동으로 요청을 스킬에 매칭시킵니다. 스킬을 수동으로 선택할 필요 없습니다. 필요한 스킬만 컨텍스트에 로드됩니다.

### Agent Manager UI
Antigravity IDE의 Mission Control 대시보드입니다. 에이전트 생성, 워크스페이스 할당, 인박스로 모니터링, 산출물 검토.

### Knowledge Base
에이전트 산출물이 `.gemini/antigravity/brain/`에 저장됩니다. 기획서, 코드, 리포트, 조율 메모 포함.

### Serena Memory
구조화된 런타임 상태가 `.serena/memories/`에 저장됩니다. Orchestrator가 세션 정보, 태스크 보드, 에이전트별 진행 상황, 결과를 기록합니다. 대시보드들이 이 파일들을 감시하여 모니터링합니다.

### Workspaces (워크스페이스)
에이전트들이 별도 디렉토리에서 작업하여 충돌을 피합니다:
```
./backend    → Backend Agent 워크스페이스
./frontend   → Frontend Agent 워크스페이스
./mobile     → Mobile Agent 워크스페이스
```

---

## 사용 가능한 스킬

| 스킬 | 자동 활성화 조건 | 산출물 |
|------|----------------|--------|
| workflow-guide | 복잡한 멀티 도메인 프로젝트 | 에이전트 조율 가이드 |
| pm-agent | "기획해줘", "분석해줘" | `.agent/plan.json` |
| frontend-agent | UI, 컴포넌트, 스타일링 | React 컴포넌트, 테스트 |
| backend-agent | API, 데이터베이스, 인증 | API 엔드포인트, 모델, 테스트 |
| mobile-agent | 모바일 앱, iOS/Android | Flutter 화면, 상태 관리 |
| qa-agent | "보안 검토", "감사" | 우선순위가 있는 QA 리포트 |
| debug-agent | 버그 리포트, 에러 메시지 | 수정된 코드, 회귀 테스트 |
| orchestrator | CLI 서브에이전트 실행 | `.agent/results/`에 결과 저장 |

---

## 일반적인 워크플로우

### 워크플로우 A: 단일 스킬

```
입력: "버튼 컴포넌트 만들어줘"
  → Antigravity가 frontend-agent 로드
  → 컴포넌트 즉시 받음
```

### 워크플로우 B: 멀티 에이전트 프로젝트

```
입력: "인증이 있는 TODO 앱 만들어줘"
  → workflow-guide 활성화
  → PM Agent 기획
  → Agent Manager에서 에이전트 생성
  → 에이전트 병렬 작업
  → QA Agent 검토
  → 이슈 수정 & 반복
```

### 워크플로우 C: 버그 수정

```
입력: "로그인 버튼에서 TypeError 발생"
  → debug-agent 활성화
  → 근본 원인 분석
  → 수정 + 회귀 테스트
```

### 워크플로우 D: CLI Orchestration + 대시보드

```
터미널 1: npm run dashboard:web
터미널 2: ./scripts/spawn-subagent.sh backend "task" ./backend &
         ./scripts/spawn-subagent.sh frontend "task" ./frontend &
브라우저:  http://localhost:9847 → 실시간 상태
```

---

## 팁

1. **구체적으로** — "JWT 인증과 React 프론트엔드, FastAPI 백엔드가 있는 TODO 앱 만들어줘"가 "앱 만들어줘"보다 낫습니다.
2. **멀티 도메인은 Agent Manager 사용** — 한 채팅에서 모든 것을 하려고 하지 마세요.
3. **Knowledge Base 검토** — `.gemini/antigravity/brain/`에서 API 일관성 확인
4. **재생성으로 반복** — 처음부터 다시 하지 말고, 명령을 다듬어 재생성하세요.
5. **대시보드 사용** — `npm run dashboard` 또는 `npm run dashboard:web`로 orchestrator 세션 모니터링
6. **별도 워크스페이스** — 각 에이전트에 고유 디렉토리 할당

---

## 문제 해결

| 문제 | 해결법 |
|------|--------|
| 스킬이 로드되지 않음 | `antigravity open .`, `.agent/skills/` 확인, IDE 재시작 |
| Agent Manager를 찾을 수 없음 | View → Agent Manager 메뉴, Antigravity 2026+ 필요 |
| 에이전트 산출물이 호환되지 않음 | Knowledge Base에서 둘 다 검토, 수정하여 재생성 |
| 대시보드: "No agents" 표시 | 메모리 파일이 아직 생성되지 않음, orchestrator 실행 필요 |
| 웹 대시보드가 시작 안 됨 | `npm install`로 chokidar, ws 설치 |
| fswatch not found | macOS: `brew install fswatch`, Linux: `apt install inotify-tools` |
| QA 리포트에 50개 이상 이슈 | CRITICAL/HIGH부터 처리, 나머지는 문서화 후 나중에 |

---

## npm 스크립트

```bash
npm run dashboard       # 터미널 실시간 대시보드
npm run dashboard:web   # 웹 대시보드 → http://localhost:9847
npm run validate        # 스킬 파일 검증
npm run info            # 이 사용 가이드 출력
```

---

## 에이전트용

Orchestrator에 의해 생성되는 에이전트라면 [AGENT_GUIDE.md](./AGENT_GUIDE.md)를 참고하세요. 다음을 포함합니다:
- 진행 상황 추적 방법
- Serena Memory 파일 업데이트 방식
- 다른 에이전트와의 협력 방식
- 결과 저장 방식

---

**Antigravity IDE에서 채팅하세요.** 모니터링을 위해 대시보드를 사용하고, CLI 실행을 위해 orchestrator 스크립트를 사용합니다. 에이전트 실행 규칙은 [AGENT_GUIDE.md](./AGENT_GUIDE.md)를 참고하세요.
