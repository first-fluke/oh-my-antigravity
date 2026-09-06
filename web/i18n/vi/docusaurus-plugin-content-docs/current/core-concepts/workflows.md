---
title: Workflow
description: Tham chiếu đầy đủ cho tất cả 16 workflow oh-my-agent — lệnh slash, chế độ liên tục và không liên tục, từ khóa trigger bằng 11 ngôn ngữ, các giai đoạn và bước, file đọc và ghi, cơ chế phát hiện tự động, lọc mẫu thông tin và quản lý trạng thái chế độ liên tục.
---

# Workflow

Workflow là quy trình có cấu trúc nhiều bước được kích hoạt bởi lệnh slash hoặc từ khóa ngôn ngữ tự nhiên. Chúng định nghĩa cách agent cộng tác trong task — từ tiện ích đơn giai đoạn đến cổng chất lượng phức tạp 5 giai đoạn.

Có 16 workflow, trong đó 4 là liên tục (duy trì trạng thái và không thể bị gián đoạn ngẫu nhiên).

---

## Chọn skill hoặc workflow {#choosing-a-skill-or-workflow}

Chọn theo nhu cầu điều phối và xác minh của task. Nếu đã chọn workflow, hãy làm theo workflow đó; tiếp tục workflow đang chạy trừ khi bạn chủ động hủy hoặc đổi. Với task mới chưa chọn workflow, dùng hướng dẫn sau:

| Nhu cầu của task | Lựa chọn | Ví dụ |
|---|---|---|
| Một lĩnh vực, không cần phối hợp giữa các agent | [Skill đơn](/docs/guide/single-skill) | Thêm API endpoint và kiểm thử validation |
| Nhiều lĩnh vực, cần lập kế hoạch, triển khai và QA từng bước | `/work` | Điều phối thay đổi API cùng các client web và mobile |
| Tự động giao task độc lập để chạy song song | `/orchestrate` | Triển khai task backend và frontend song song sau khi giải quyết phụ thuộc |
| Yêu cầu rõ ràng về quy trình chất lượng toàn diện | `/ultrawork` | Thực hiện đầy đủ các bước lập kế hoạch, triển khai, xác minh, tinh chỉnh và đánh giá mức độ sẵn sàng phát hành |
| Yêu cầu rõ ràng về việc lặp lại thực thi đến khi đạt tiêu chí kiểm chứng được bằng máy | `/ralph` | Lặp lại triển khai và xác minh độc lập đến khi các kiểm tra hồi quy đã chỉ định đều pass, trong giới hạn bảo vệ của vòng lặp |

`/orchestrate` tải kế hoạch dùng được hoặc tạo kế hoạch qua `/plan` trước khi spawn agent. Bạn không cần chạy `/plan` trước. Vì vậy, việc đã có kế hoạch không phải là điểm phân biệt `/work` và `/orchestrate`; hãy chọn theo cách bạn muốn điều phối công việc. Cả hai đều có thể chạy task độc lập song song.

Tiêu chí chấp nhận và test cũng thuộc công việc dùng skill đơn. Chỉ có các tiêu chí này không có nghĩa là cần `/ralph`. Mỗi lần lặp Ralph chạy toàn bộ quy trình ultrawork và một judge độc lập, nên hãy chọn khi bạn muốn lặp lại quy trình xác minh đó. Vòng lặp có thể dừng khi còn công việc chưa hoàn thành hoặc bị chặn nếu cơ chế bảo vệ áp dụng.

Bảng này hướng dẫn lựa chọn, không phải bộ định tuyến workflow tự động. Agent chính có thể đề xuất cách làm phù hợp; việc đề xuất hoặc giải thích workflow không khởi chạy nó. Lệnh slash chọn workflow một cách tường minh. Khi hook phát hiện từ khóa được bật, việc khớp từ khóa hoặc mẫu đã cấu hình cũng có thể kích hoạt workflow, tùy bộ lọc câu hỏi thông tin. Bộ phát hiện không phân loại số lĩnh vực, kiểm tra kế hoạch đã sẵn sàng hay dùng bảng này làm thuật toán ưu tiên.

Việc đánh giá kế hoạch kế thừa quyền đã được cấp cho task. Agent chỉ hỏi khi thiếu quyết định quan trọng hoặc cần thực hiện hành động ngoài phạm vi đó. Đánh giá mức độ sẵn sàng phát hành không tự cấp quyền xuất bản hoặc triển khai.

---

## Workflow liên tục

Workflow liên tục tiếp tục chạy cho đến khi tất cả task hoàn thành. Chúng duy trì trạng thái trong `.agents/state/` và đưa lại ngữ cảnh `[OMA PERSISTENT MODE: ...]` vào mỗi tin nhắn người dùng cho đến khi được vô hiệu hóa tường minh.

### /orchestrate

**Mô tả:** Thực thi agent song song tự động qua CLI. Spawn subagent qua CLI, điều phối qua MCP memory, giám sát tiến trình và chạy vòng lặp xác minh.

**Liên tục:** Có. File trạng thái: `.agents/state/orchestrate-state.json`.

**Mẫu regex trigger** (intent + danh sách trắng danh từ, xem [Phát hiện tự động: trường Pattern](#pattern-field-raw-regex)):
| Section | Pattern | Ví dụ kích hoạt |
|---------|---------|----------------------|
| `*` (chung) | `(build\|create\|make\|develop\|implement\|scaffold) + (a\|an\|the) + [modifier]{0,3} + <noun>` | "Build a TODO app with user authentication", "Create an awesome web service", "Develop a backend with PostgreSQL" |
| `*` (chung) | `i want a/an + <noun>` | "I want a CLI for parsing logs" |
| `ko` | `<noun> + (을\|를\|이\|가)? + (만들어\|구현해\|개발해 + biến thể)` | "TODO 앱 만들어줘", "REST API 구현해", "백엔드를 개발해주세요" |

Danh sách trắng danh từ (15): app, api, service, server, cli, tool, website, dashboard, system, feature, backend, frontend, prototype, mvp, bot.

**Tải hoặc tạo kế hoạch:** Kiểm tra `.agents/results/plan-{sessionId}.json`, rồi đến `plan-*.json` mới nhất. Nếu không có kế hoạch, hoặc task thiếu agent, tier ưu tiên, phụ thuộc hay tiêu chí chấp nhận, giao cho `/plan` tạo kế hoạch inline với cùng session ID. Trình bày kế hoạch và kế thừa quyền hiện có; trước khi giao task, chỉ hỏi khi thiếu quyết định quan trọng hoặc cần quyền mới.

**Khởi tạo phiên:** Tải `oma-config.yaml`, hiển thị bảng ánh xạ CLI, dùng lại session ID từ lúc tạo kế hoạch hoặc tạo ID mới (`session-YYYYMMDD-HHMMSS`). Tạo `orchestrator-session.md` và `task-board.md` trong bộ nhớ.

### /work

**Mô tả:** Điều phối đa lĩnh vực từng bước. PM lập kế hoạch trước, sau đó agent thực thi trong phạm vi được cho phép, tiếp theo là đánh giá QA và khắc phục vấn đề.

**Liên tục:** Có. File trạng thái: `.agents/state/work-state.json`.

**Đánh giá kế hoạch:** Trình bày kế hoạch và tiếp tục trong phạm vi quyền hiện có. Chỉ hỏi khi thiếu quyết định quan trọng hoặc cần quyền mới.

**Khi dùng:** Tính năng trải nhiều lĩnh vực cần điều phối lập kế hoạch, triển khai và QA từng bước.

### /ultrawork

**Mô tả:** Workflow chú trọng chất lượng. 5 giai đoạn, 17 bước tổng, 11 bước đánh giá. Mỗi giai đoạn có cổng phải pass trước khi tiếp tục.

**Liên tục:** Có. File trạng thái: `.agents/state/ultrawork-state.json`.

**Giai đoạn:**

| Giai đoạn | Bước | Agent | Góc nhìn đánh giá |
|-------|-------|-------|-------------------|
| **PLAN** | 1-4 | Agent PM (inline) | Hoàn chỉnh, Meta-review, Chống over-engineering/Đơn giản |
| **IMPL** | 5 | Agent Dev (spawn) | Triển khai |
| **VERIFY** | 6-8 | Agent QA (spawn) | Đồng bộ, An toàn (OWASP), Ngăn hồi quy |
| **REFINE** | 9-13 | Agent Debug (spawn) | Tách file, Tái sử dụng, Tác động lan truyền, Nhất quán, Dead code |
| **SHIP** | 14-17 | Agent QA (spawn) | Chất lượng mã (lint/coverage), UX Flow, Vấn đề liên quan, Sẵn sàng triển khai |

**Các cổng về kế hoạch, triển khai và phát hành:**
- **PLAN_GATE:** Kế hoạch được ghi lại, giả định được liệt kê, các phương án được cân nhắc, đánh giá chống over-engineering hoàn tất và phạm vi công việc được cho phép.
- **IMPL_GATE:** Các kiểm tra áp dụng không sinh file đầu ra và test đều pass, chỉ sửa file trong kế hoạch, ghi Quality Score ban đầu nếu có đo. Chỉ chạy kiểm tra build khi được yêu cầu rõ ràng.
- **SHIP_GATE:** Kiểm tra chất lượng và UX đều pass, vấn đề liên quan được giải quyết, checklist triển khai hoàn tất. Nếu có đo, Quality Score cuối phải >= 75 và không giảm. Kế thừa quyền hiện có; xuất bản hoặc triển khai cần quyền cho chính hành động đó.

### /ralph

**Mô tả:** Vòng lặp thực thi tự tham chiếu liên tục. Bọc ultrawork với verifier độc lập kiểm tra tiêu chí hoàn thành sau mỗi lần lặp. Báo cáo hoàn thành toàn bộ khi mọi tiêu chí đều pass, hoàn thành một phần khi chỉ còn tiêu chí đã pass và tiêu chí bị chặn, hoặc dừng khi cơ chế bảo vệ kích hoạt.

**Liên tục:** Có. File trạng thái: `.agents/state/ralph-state.json`.

**Khởi tạo và đánh giá:** Tải các tài nguyên cần thiết (context-loading, giao thức bộ nhớ, giao thức judge). Định nghĩa và ghi lại tiêu chí hoàn thành kiểm chứng được bằng máy, chẳng hạn assertion của test, kiểm tra kiểu không sinh file đầu ra, mã thoát hoặc sự tồn tại của file. Chỉ đưa kiểm tra build vào khi được yêu cầu rõ ràng. Trình bày tiêu chí và tiếp tục trong phạm vi được cho phép, với `max_iterations: 5`. Judge độc lập đối chiếu từng tiêu chí với trạng thái thực tế bằng các kiểm tra được cho phép và kiểm tra sự tồn tại của file. Ghi lại bằng chứng cùng trạng thái PASS, FAIL, REGRESSED hoặc BLOCKED.

**Quyết định:** Nếu mọi tiêu chí đều PASS, báo cáo hoàn thành toàn bộ. Nếu chỉ còn PASS và BLOCKED, báo cáo hoàn thành một phần. Nếu có FAIL hoặc REGRESSED, chuyển ngữ cảnh thất bại sang lần lặp tiếp theo trong giới hạn bảo vệ. Vòng lặp dừng khi `current_iteration >= max_iterations` (mặc định 5), hoặc cùng một tiêu chí thất bại 3 lần liên tiếp với cùng nguyên nhân gốc.

**Khác biệt chính so với /ultrawork:** Ultrawork chạy quy trình 5 giai đoạn và thử lại khi một cổng không đạt. Ralph bọc ultrawork trong vòng lặp thử lại, với judge độc lập xác minh việc hoàn thành. Vòng lặp kết thúc bằng báo cáo hoàn thành toàn bộ, hoàn thành một phần do công việc bị chặn, hoặc báo cáo dừng theo cơ chế bảo vệ.

**Khi dùng:** Khi bạn yêu cầu rõ ràng việc lặp lại thực thi và xác minh độc lập theo tiêu chí hoàn thành kiểm chứng được bằng máy. Chỉ có test không có nghĩa là cần Ralph; hãy tính đến toàn bộ quy trình ultrawork trong mỗi lần lặp và các cơ chế bảo vệ.

---

## Workflow không liên tục

### /plan

**Mô tả:** Phân tách task do PM dẫn dắt. Phân tích yêu cầu, chọn tech stack, phân tách thành task có ưu tiên với phụ thuộc, định nghĩa API contract.

**Đầu ra:** `.agents/results/plan-{sessionId}.json`, ghi bộ nhớ.

### /exec-plan

**Mô tả:** Tạo, quản lý và theo dõi kế hoạch thực thi dưới dạng artifact repository trong `docs/exec-plans/`.

### /brainstorm

**Mô tả:** Khám phá ý tưởng ưu tiên thiết kế. Khám phá ý định, làm rõ ràng buộc, đề xuất hướng tiếp cận, tạo tài liệu thiết kế được duyệt trước khi lập kế hoạch.

### /architecture

**Mô tả:** Workflow kiến trúc phần mềm — chẩn đoán vấn đề kiến trúc, chọn phương pháp phân tích phù hợp (định tuyến chẩn đoán / design-twice / ATAM / CBAM / ADR), so sánh tùy chọn, tổng hợp ý kiến bên liên quan, và tạo khuyến nghị, đánh giá hoặc ADR.

**Từ khóa trigger:**
| Ngôn ngữ | Từ khóa |
|----------|----------|
| Chung | "architecture", "ADR", "ATAM", "CBAM" |
| Tiếng Anh | "architecture review", "architectural tradeoff" |
| Tiếng Hàn | "아키텍처", "설계 검토" |
| Tiếng Nhật | "アーキテクチャ" |
| Tiếng Trung | "架构" |

**Các bước:** Định khung quyết định (kiến trúc mới / đánh giá / phân tích đánh đổi / ưu tiên đầu tư / viết ADR) -> Chọn phương pháp qua định tuyến chẩn đoán -> Phân tích kiến trúc hiện tại qua MCP code analysis (`get_symbols_overview`, `find_symbol`, `find_referencing_symbols`) -> Tổng hợp ý kiến bên liên quan (chỉ khi quyết định đủ cross-cutting để biện minh chi phí) -> Tạo khuyến nghị với giả định, đánh đổi, rủi ro, bước xác minh rõ ràng -> Bàn giao cho `/plan` khi cần triển khai.

**Quy tắc:** KHÔNG viết code triển khai hoặc kế hoạch task trong workflow này. Bàn giao cho `/plan` sau quyết định kiến trúc. Luôn dùng MCP tools; không thay thế bằng đọc file thô hoặc grep.

**Khi dùng:** Lựa chọn kiến trúc hệ thống, quyết định ranh giới module/service/ownership, ưu tiên refactor, viết ADR, điều tra khó khăn kiến trúc (khuếch đại thay đổi, phụ thuộc ẩn, API vụng).

---

### /deepinit

**Mô tả:** Khởi tạo dự án đầy đủ. Phân tích codebase hiện có, tạo AGENTS.md, ARCHITECTURE.md và cơ sở kiến thức `docs/` có cấu trúc.

### /review

**Mô tả:** Pipeline đánh giá QA đầy đủ. Kiểm tra bảo mật (OWASP Top 10), phân tích hiệu suất, kiểm tra accessibility (WCAG 2.1 AA) và đánh giá chất lượng mã.

### /deepsec

**Mô tả:** Điều phối skill `oma-deepsec` từ đầu đến cuối. Cài `.deepsec/`, hiệu chuẩn chi phí, chạy các bước scan/process/triage/revalidate/export, chặn PR bằng `process --diff`, viết matcher tùy chỉnh và định tuyến phát hiện tới các agent chuyên trách. Chạy inline (không spawn subagent).

**Từ khóa kích hoạt:** "/deepsec", "deepsec workflow" (chung); "run deepsec", "deepsec pr review", "deepsec ci gate", "deepsec triage", "deepsec matchers" (tiếng Anh).

**Các bước:** Tải skill và chỉ các file resource khớp intent (`setup.md`, `scanning.md`, `pr-review.md`, `matchers.md`, `triage.md`, `config.md`); nếu `.deepsec/` đã tồn tại thì coi là chạy gia tăng, không `init` lại. Phân loại thành đúng một trong `setup`, `scan`, `pr-review`, `matchers`, `triage`, `config`, `troubleshoot`; chèn `setup` trước nếu thiếu `.deepsec/`. Xác nhận `claude` vs `codex` trước cuộc gọi tính phí. Thực thi: `setup` viết `data/<id>/INFO.md` (cần xác nhận người dùng); `scan` hiệu chuẩn `--limit 50 --concurrency 5`, ngoại suy chi phí, chạy `process` đầy đủ, `triage --severity HIGH` + `revalidate --min-severity HIGH`, `export`; `pr-review` dùng `process --diff origin/${BASE_REF} --comment-out comment.md` theo mẫu CI hai job; `matchers` viết `.deepsec/matchers/<slug>.ts` ở mức nhiễu phù hợp (`precise`/`normal`/`noisy`) rồi kiểm tra `scan --matchers`; `triage` lọc export về `true-positive`/`uncertain`. Tổng kết và định tuyến theo **lớp của file dễ tổn thương** (backend -> `oma-backend`, frontend -> `oma-frontend`, mobile -> `oma-mobile`, IaC -> `oma-tf-infra`, DB -> `oma-db`, CI -> `oma-dev-workflow`, drift docs -> `oma-docs`, thiếu entry-point -> quay lại bước matchers); lớp mơ hồ hoặc `revalidation.verdict === "uncertain"` thì đi qua `oma-debug` trước.

**Quy tắc:** Không sửa mã nguồn sản phẩm trong workflow này. Không in hoặc commit credentials (`vck_…`, `sk-ant-…`, token OIDC). Không cấp `pull-requests: write` cho job CI chạy mã do PR điều khiển. Khi gián đoạn thì chạy lại cùng lệnh; không bao giờ `rm -rf data/<id>/` nếu người dùng không yêu cầu rõ.

**Khi dùng:** Quét lỗ hổng repo bằng agent, gating bảo mật CI/PR qua `process --diff`, viết matcher riêng cho dự án để phủ entry-point, triage phát hiện cũ để giảm FP.

### /debug

**Mô tả:** Chẩn đoán và sửa lỗi có cấu trúc với viết test hồi quy và quét mẫu tương tự.

### /design

**Mô tả:** Workflow thiết kế 7 giai đoạn tạo DESIGN.md với token, mẫu component và quy tắc accessibility.

### /scm

**Mô tả:** Tạo Conventional Commits với tự động tách theo tính năng.

### /tools

**Mô tả:** Quản lý khả năng hiển thị và hạn chế công cụ MCP.

### /convert

**Mô tả:** Chuyển đổi file từ định dạng này sang định dạng khác, định tuyến theo loại media. **Tài liệu** (PDF qua `opendataloader-pdf`/`oma-pdf`; HWP/HWPX/HWPML qua `kordoc`/`oma-hwp`) trích xuất sang Markdown. File **hình ảnh**, **video** và **âm thanh** transcode sang định dạng đích qua `ffmpeg` (đã được cấp sẵn cho `oma-video`).

**Từ khóa trigger:** Không (gọi tường minh với đường dẫn file đầu vào).

**Các bước:** Xác minh đầu vào & định tuyến theo loại (tài liệu `.pdf`/`.hwp*`; hình ảnh `.jpg`/`.png`/`.webp`/…; video `.mp4`/`.mov`/…; âm thanh `.mp3`/`.wav`/…) -> Xác định định dạng đích (tài liệu mặc định = Markdown; media = `--to` tường minh) -> Chuyển đổi (PDF: `uvx opendataloader-pdf`, PDF quét dùng OCR hybrid; HWP: `bunx kordoc@latest`; media: `ffmpeg`) -> Chuẩn hóa tài liệu (PDF: `uvx mdformat`; HWP: `flatten-tables.ts`) -> Xác minh (đọc Markdown / `ffprobe` media) -> Báo cáo định dạng nguồn→đích và mọi lựa chọn chất lượng/codec.

**Quy tắc:** Định tuyến theo loại — không bao giờ chạy bộ chuyển đổi tài liệu trên file media hoặc ngược lại. Vị trí đầu ra mặc định là cùng thư mục với file đầu vào. Báo cáo lựa chọn chất lượng/codec cho media (transcode không phải không mất mát). Không bao giờ bỏ qua bước. Ngôn ngữ phản hồi theo `.agents/oma-config.yaml`.

**Khi dùng:** Chuyển đổi tài liệu PDF hoặc dòng HWP của Hàn Quốc sang Markdown cho ngữ cảnh LLM/RAG, hoặc transcode hình ảnh (jpg→webp/png), video (mov→mp4, mp4→gif) và âm thanh (wav→mp3) giữa các định dạng.

---

### /stack-set

**Mô tả:** Tự phát hiện tech stack dự án và tạo tham chiếu theo ngôn ngữ cho skill backend.

---

## Skill so với workflow

| Khía cạnh | Skill | Workflow |
|--------|--------|-----------|
| **Là gì** | Chuyên môn agent (agent biết gì) | Quy trình điều phối (agent làm việc cùng nhau thế nào) |
| **Vị trí** | `.agents/skills/oma-{name}/` | `.agents/workflows/{name}.md` |
| **Kích hoạt** | Tự động qua từ khóa định tuyến skill | Lệnh slash hoặc từ khóa trigger |
| **Phạm vi** | Thực thi đơn lĩnh vực | Nhiều bước, thường đa agent |
| **Ví dụ** | "Build a React component" | "Plan the feature -> build -> review -> commit" |

---

## Phát hiện tự động: cách hoạt động

### Hệ thống hook

oh-my-agent dùng hook `UserPromptSubmit` chạy trước mỗi tin nhắn người dùng được xử lý:

1. **`triggers.json`**: Định nghĩa ánh xạ từ khóa-workflow cho 11 ngôn ngữ được hỗ trợ.
2. **`keyword-detector.ts`**: Logic TypeScript quét đầu vào người dùng so với từ khóa trigger và đưa ngữ cảnh kích hoạt workflow vào.
3. **`persistent-mode.ts`**: Áp dụng thực thi workflow liên tục bằng cách kiểm tra file trạng thái đang hoạt động.

### Luồng phát hiện

1. Bạn nhập đầu vào ngôn ngữ tự nhiên
2. Hook kiểm tra xem có lệnh `/command` tường minh hay không (nếu có, bỏ qua phát hiện để tránh trùng lặp)
3. Hook làm sạch đầu vào (loại bỏ code block, chuỗi trích dẫn, các khối system-echo đã dán) rồi quét so với `.agents/hooks/core/triggers.json` — cả danh sách keyword (cụm từ literal) và `patterns` (regex thô). Một lớp bảo vệ tăng cường ngăn chặn việc kích hoạt lại nếu cùng một workflow đã trigger từ 2 lần trở lên trong 60 giây gần nhất.
4. Nếu tìm thấy khớp, kiểm tra xem đầu vào có khớp các mẫu thông tin hay không
5. Nếu mang tính thông tin (ví dụ: "what is orchestrate?"), lọc ra — không workflow nào được kích hoạt
6. Nếu mang tính hành động, đưa `[OMA WORKFLOW: {workflow-name}]` vào ngữ cảnh
7. Agent đọc tag được đưa vào và tải file workflow tương ứng từ `.agents/workflows/`

### Quy ước section ngôn ngữ

`.agents/hooks/core/triggers.json` dùng cấu trúc section theo ngôn ngữ cho `keywords`, `patterns` và `informationalPatterns`:

| Section | Hành vi |
|---------|----------|
| `*` | Chung — luôn được tải bất kể cài đặt `language` trong `.agents/oma-config.yaml`. Dùng cho nội dung tiếng Anh (ngôn ngữ chung) và token thực sự xuyên ngôn ngữ (ví dụ tên workflow `"orchestrate"`). |
| `en` | Tiếng Anh — được tải để tương thích ngược. Tương đương về chức năng với `*`. Nội dung tiếng Anh mới nên đưa vào `*`. |
| `ko`, `ja`, `zh`, `es`, `fr`, `de`, `pt`, `ru`, `nl`, `pl` | Theo ngôn ngữ — chỉ được tải khi `language: <lang>` được đặt trong `.agents/oma-config.yaml`. |

**Hệ quả**: Nếu bạn đặt `language: en` trong `.agents/oma-config.yaml`, chỉ pattern `*` và `en` được tải. Trigger ngôn ngữ tự nhiên tiếng Hàn/Nhật/v.v. sẽ không kích hoạt ngay cả khi người dùng gõ trong các ngôn ngữ đó. Để bật một ngôn ngữ không phải tiếng Anh, đặt `language: <code>` tương ứng. Fallback tiếng Anh trong `*` luôn duy trì hoạt động.

### Trường pattern (regex thô) {#pattern-field-raw-regex}

Ngoài `keywords` literal, mỗi workflow có thể khai báo `patterns` — chuỗi regex thô được biên dịch với cờ `iu`. Pattern cho phép khớp intent đa token mà nếu không sẽ yêu cầu danh sách keyword tổ hợp.

```jsonc
{
  "workflows": {
    "orchestrate": {
      "persistent": true,
      "keywords": { "*": ["orchestrate"], "en": ["parallel", ...] },
      "patterns": {
        "*": ["\\b(build|create|make)\\s+(?:an?|the)\\s+...\\b"],
        "ko": ["(앱|API|...)\\s*(?:을|를)?\\s*(?:만들어\\s*(?:주세요|줘)?|...)"]
      }
    }
  }
}
```

Quy tắc soạn thảo:
- Chuỗi được biên dịch trực tiếp — escape backslash một lần cho JSON, một lần cho regex (`\\b`, `\\s+`)
- Không tự động bọc word-boundary — tác giả pattern tự xử lý `\b`
- Regex không hợp lệ bị bỏ qua âm thầm khi runtime (hiển thị tại thời điểm chỉnh sửa config qua test thất bại)

### Lọc mẫu thông tin

Section `informationalPatterns` của `.agents/hooks/core/triggers.json` định nghĩa các cụm từ chỉ ra câu hỏi thay vì lệnh. Được kiểm tra trong cửa sổ 60 ký tự xung quanh mỗi khớp workflow tiềm năng:

| Section | Ví dụ pattern |
|---------|----------------------|
| `*` (chung tiếng Anh) | "what is", "what are", "how to", "how does", "how do", "should we", "should i", "could we", "would you", "what if", "what about", "why build", "false positive", "trigger when", "auto-trigger" |
| `ko` | "뭐야", "무엇", "어떻게", "설명해", "알려줘", "트리거", "발동", "메타", "왜 만들", "어떻게 만들", "어떨까", "한다면", "할까요" |
| `ja` | "とは", "って何", "どうやって", "説明して" |
| `zh` | "是什么", "什么是", "怎么", "解释" |

Nếu đầu vào khớp cả trigger workflow và mẫu thông tin, mẫu thông tin được ưu tiên và không workflow nào được kích hoạt. Đây là điều chặn các prompt như:
- `"How do you build a TODO app?"` — `how do` trong `*` chặn regex intent orchestrate
- `"orchestrate 트리거 해주면 되나요?"` (dưới `language: ko`) — `트리거` trong `ko` chặn keyword orchestrate

### Workflow loại trừ

Các workflow sau bị loại trừ khỏi phát hiện tự động và phải được gọi bằng `/command` tường minh:
- `/scm`
- `/tools`
- `/stack-set`
- `/exec-plan`
- `/convert`

---

## Cơ chế chế độ liên tục

### File trạng thái

Workflow liên tục (orchestrate, ultrawork, work, ralph) tạo file trạng thái trong `.agents/state/`.

### Tăng cường

Trong khi workflow liên tục đang hoạt động, hook `persistent-mode.ts` đưa `[OMA PERSISTENT MODE: {workflow-name}]` vào mỗi tin nhắn người dùng. Đảm bảo workflow tiếp tục thực thi xuyên các lượt hội thoại.

### Vô hiệu hóa

Để vô hiệu hóa workflow liên tục, người dùng nói "workflow done" (hoặc tương đương trong ngôn ngữ đã cấu hình). Thao tác này xóa file trạng thái, dừng đưa ngữ cảnh chế độ liên tục và trở về hoạt động bình thường.

---

## Chuỗi workflow điển hình

### Tính năng đơn lĩnh vực
```
Describe the task → relevant skill → implement → focused verification
```

### Dự án đa lĩnh vực phức tạp
```
/work → PM plans → review within authorized scope → agents spawn → QA reviews → fix issues → report
```

### Tự động triển khai song song
```
/orchestrate → load or create plan → resolve dependencies → spawn independent tasks → verify → report
```

### Phân phối chất lượng tối đa
```
/ultrawork → PLAN (4 bước đánh giá) → IMPL → VERIFY (3 bước đánh giá) → REFINE (5 bước đánh giá) → SHIP (4 bước đánh giá)
```

### Điều tra lỗi
```
/debug → tái hiện → nguyên nhân gốc → sửa tối thiểu → test hồi quy → quét mẫu tương tự
```

### Pipeline từ thiết kế đến triển khai
```
/brainstorm → tài liệu thiết kế → /plan → phân tách task → /orchestrate → triển khai song song → /review → /scm
```

### Lặp lại thực thi với xác minh độc lập
```
/ralph → define criteria → ultrawork → judge → repeat as needed → completion, partial completion, or safeguard report
```
