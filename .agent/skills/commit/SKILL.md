---
name: commit
description: Create git commits following Conventional Commits specification with project-specific branch naming rules
---

# Commit Skill - Conventional Commits

## When to use
- 사용자가 "커밋해줘", "commit", "변경사항 저장" 요청 시
- `/commit` 명령 시

## Configuration
프로젝트별 설정: `.agent/skills/commit/config/commit-config.yaml`

## Commit Types
| Type | Description | Branch Prefix |
|------|-------------|---------------|
| feat | 새 기능 추가 | feature/ |
| fix | 버그 수정 | fix/ |
| refactor | 코드 개선 | refactor/ |
| docs | 문서 변경 | docs/ |
| test | 테스트 추가/수정 | test/ |
| chore | 빌드, 설정 등 | chore/ |
| style | 코드 스타일 변경 | style/ |
| perf | 성능 개선 | perf/ |

## Commit Format
```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Workflow

### Step 1: Analyze Changes
```bash
git status
git diff --staged
git log --oneline -5
```

### Step 1.5: Split by Feature (if needed)
변경 파일이 여러 기능/도메인에 걸쳐 있으면, **기능 단위로 커밋을 분리**하라.

**분리 기준:**
- 서로 다른 scope (예: workflows vs skills vs docs)
- 서로 다른 type (예: feat vs fix vs docs)
- 논리적으로 독립된 변경사항

**예시:**
```
# 변경 파일 목록:
.agent/workflows/*.md (7개)     → fix(workflows): ...
.agent/skills/**/*.md (4개)     → fix(skills): ...
USAGE.md, USAGE-ko.md           → docs: ...

# 3개의 커밋으로 분리
```

**분리하지 않는 경우:**
- 모든 변경이 하나의 기능에 속함
- 변경 파일 수가 적음 (5개 이하)
- 사용자가 단일 커밋 요청

### Step 2: Determine Commit Type
변경 내용 분석 → 적절한 type 선택:
- 새 파일 추가 → `feat`
- 버그 수정 → `fix`
- 리팩토링 → `refactor`
- 문서만 변경 → `docs`
- 테스트 추가 → `test`
- 빌드/설정 변경 → `chore`

### Step 3: Determine Scope
변경된 모듈/컴포넌트를 scope로 사용:
- `feat(auth)`: 인증 관련
- `fix(api)`: API 관련
- `refactor(ui)`: UI 관련
- scope 없이도 가능: `chore: update dependencies`

### Step 4: Write Description
- 72자 이내
- 명령형 사용 (add, fix, update, remove...)
- 첫 글자 소문자
- 마침표 없음

### Step 5: Confirm with User
```
📝 커밋 메시지 미리보기:

feat(orchestrator): add multi-CLI agent mapping support

- Add user-preferences.yaml for CLI configuration
- Update spawn-agent.sh to read agent-CLI mapping
- Update memory schema with CLI field

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

이대로 커밋하시겠습니까? (Y/N/수정)
```

### Step 6: Execute Commit
사용자 확인 후:
```bash
git add <specific-files>
git commit -m "<message>"
```

## References
- 설정: `config/commit-config.yaml`
- 가이드: `resources/conventional-commits.md`

## Important Notes
- **NEVER** commit without user confirmation
- **NEVER** use `git add -A` or `git add .` without explicit permission
- **NEVER** commit files that may contain secrets (.env, credentials, etc.)
- **ALWAYS** use specific file names when staging
- **ALWAYS** use HEREDOC for multi-line commit messages
