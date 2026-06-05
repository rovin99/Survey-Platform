# Technical Flows — Code Execution, Media Upload, Anonymous Survey Taking

This document explains three complex features in detail: how they work internally, what services are involved, and the security measures in place.

---

## 1. Code Editor — Setup & Execution Flow

### Architecture

```
┌─────────────┐     ┌───────────┐     ┌──────────────┐
│  Browser     │────▶│  Nginx    │────▶│  Piston      │
│  (CodeMirror)│◀────│  (proxy)  │◀────│  (sandboxed) │
└─────────────┘     └───────────┘     └──────────────┘
                         │
                    Rate limit: 5/min
                    Auth: cookie check
                    Network: isolated
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CodeMirror Editor | `frontend/src/components/survey-taking/CodeEditor.tsx` | In-browser code editing with syntax highlighting |
| Code Question Editor | `frontend/src/components/survey/CodeQuestionEditor.tsx` | Conductor UI for configuring languages, test cases, starter code |
| Code Execution Service | `frontend/src/services/codeExecution.service.ts` | Client-side API wrapper for Piston |
| Piston Engine | Docker container (`ghcr.io/engineer-man/piston`) | Sandboxed code execution (50+ languages) |
| Nginx Proxy | `infrastructure/nginx/nginx.conf` | Auth check + rate limit before reaching Piston |
| Quiz Evaluation Service | `ParticipantsManagementService/services/quiz-evaluation-service.go` | Server-side test case execution during grading |

### Supported Languages

Python 3.10, JavaScript 18.15, TypeScript 5.0, Java 15, C++ 10.2 (GCC), C 10.2 (GCC), Go 1.16, Rust 1.68 — all versions matched between frontend config and Piston runtime.

### Flow A: Conductor Creates a Code Question

```
1. Conductor selects "Code Editor" question type in survey creator

2. CodeQuestionEditor renders with:
   - Language selector (toggle badges for each language)
   - Default language dropdown
   - Starter code editor per language (optional)
   - Test case builder:
     ┌──────────────────────────────────────────────────┐
     │  Test Case #1                                     │
     │  Input:           "5\n3"                          │
     │  Expected Output:  "8"                            │
     │  Hidden:           ☐ (visible to participant)     │
     ├──────────────────────────────────────────────────┤
     │  Test Case #2                                     │
     │  Input:           "10\n-2"                        │
     │  Expected Output:  "8"                            │
     │  Hidden:           ☑ (hidden from participant)    │
     └──────────────────────────────────────────────────┘

3. Settings serialized to JSON and stored in the question's
   `correct_answers` field (overloaded — not actual "answers"):
   {
     "defaultLanguage": "python",
     "allowedLanguages": ["python", "cpp", "java"],
     "testCases": [
       { "id": "tc_1", "input": "5\n3", "expectedOutput": "8", "hidden": false },
       { "id": "tc_2", "input": "10\n-2", "expectedOutput": "8", "hidden": true }
     ],
     "starterCode": {
       "python": "# Read two numbers\na = int(input())\nb = int(input())\nprint(a + b)",
       "cpp": "#include <iostream>\nusing namespace std;\nint main() { ... }"
     }
   }

4. Survey published → question stored in DB with type "code"
```

### Flow B: Participant Takes a Code Question

```
1. QuestionRenderer detects questionType === "code"
   → Parses codeSettings from question (JSON string or object)
   → Renders CodeEditor component with settings

2. Participant sees:
   ┌──────────────────────────────────────────────┐
   │  Language: [Python ▾]                         │
   │  ┌────────────────────────────────────────┐  │
   │  │  # starter code appears here           │  │
   │  │  a = int(input())                      │  │
   │  │  b = int(input())                      │  │
   │  │  print(a + b)                          │  │
   │  └────────────────────────────────────────┘  │
   │                                               │
   │  [▶ Run Code]  [▶ Run Tests]                 │
   │                                               │
   │  ┌─ Output ──────────────────────────────┐   │
   │  │  (empty — click Run to execute)        │   │
   │  └───────────────────────────────────────┘   │
   └──────────────────────────────────────────────┘

3. Click "Run Code":
   Browser → POST /api/piston/execute
   {
     "language": "python",
     "version": "3.10.0",
     "files": [{ "name": "main.py", "content": "<user's code>" }],
     "stdin": "<custom input>",
     "run_timeout": 3000,
     "compile_timeout": 3000
   }

   Nginx checks:
   ├─ accessToken cookie present? No → 401 Unauthorized
   ├─ Rate limit exceeded (5/min)? Yes → 429 Too Many Requests
   └─ OK → proxy to Piston container

   Piston executes in sandbox → returns:
   {
     "run": {
       "stdout": "8\n",
       "stderr": "",
       "code": 0
     }
   }

   Output displayed in editor panel.

4. Click "Run Tests":
   For each visible test case:
     → executeCode(language, code, testCase.input)
     → Compare stdout.trim() === expectedOutput.trim()
     → Display ✅ Passed or ❌ Failed per test

5. Submit quiz:
   Answer stored as: { "value": { "code": "<source>", "language": "python" } }
   (Test results NOT stored — re-evaluated server-side during grading)
```

### Flow C: Server-Side Test Case Evaluation (During Grading)

```
1. Participant submits quiz → redirects to quiz results page

2. Results page calls POST /api/participant/sessions/{id}/evaluate

3. QuizEvaluationService detects question type === "code":
   a. Extracts code and language from answer
   b. Parses test cases from question's correct_answers JSON
   c. For each test case:
      → POST http://piston:2000/api/v2/execute
        (direct container-to-container via piston_net network)
      → Compare stdout.trim() with expectedOutput.trim()
   d. Result: "2/3 test cases passed"

4. Grading logic:
   - ALL test cases pass → full points (auto-graded)
   - Any test case fails → 0 points + pendingEvaluation: true
     (conductor can override with partial credit via inline marks editing)

5. Participant sees:
   ┌─────────────────────────────────────────────┐
   │ 🕐 Question 6 — Pending Evaluation           │
   │                                               │
   │  Your code:                                   │
   │  ┌─────────────────────────────────────────┐ │
   │  │  #include <iostream>                     │ │
   │  │  int main() {                            │ │
   │  │    std::cout << "Hello World";           │ │
   │  │  }                                       │ │
   │  └─────────────────────────────────────────┘ │
   │  Language: cpp                                │
   │  Test cases: 1/2 passed                       │
   │                                               │
   │  This question will be graded by your         │
   │  instructor.                                  │
   └─────────────────────────────────────────────┘
```

### Security Measures

| Measure | Implementation |
|---------|---------------|
| Authentication | Nginx checks `accessToken` cookie before proxying to Piston |
| Rate limiting | 5 requests/min per IP (burst of 3) via nginx `limit_req_zone` |
| Network isolation | Piston on separate Docker network (`piston_net`). Only nginx and participants-service can reach it. Auth, survey, frontend, postgres, MinIO cannot. |
| Execution timeout | 3 seconds per run, 3 seconds per compile |
| Sandbox | Piston runs each execution in an isolated process with tmpfs |

---

## 2. Media Upload — Setup & Flow

### Architecture

```
┌──────────┐     ┌───────┐     ┌─────────────────────┐     ┌───────┐
│ Browser   │────▶│ Nginx │────▶│ Participants Service │────▶│ MinIO │
│ (upload)  │     │       │     │ (validates + uploads) │     │ (S3)  │
└──────────┘     │       │     └─────────────────────┘     └───────┘
                 │       │
│ Browser   │◀───│       │◀──── /uploads/uuid.jpg ──────── MinIO
│ (display) │    │(proxy)│     (nginx proxies to MinIO)
└──────────┘     └───────┘
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ImageUploadRenderer | `frontend/src/components/survey-taking/QuestionRenderer.tsx` | Upload UI with preview, replace, remove |
| surveyTakingService.uploadImage | `frontend/src/services/surveyTaking.service.ts` | API call with session token |
| Media Handler | `ParticipantsManagementService/handler/media-handler.go` | HTTP endpoint for file upload |
| Storage Client | `ParticipantsManagementService/utils/storage/minio.go` | MinIO S3 upload with validation |
| MinIO | Docker container (`minio/minio`) | S3-compatible object storage |
| Nginx | `infrastructure/nginx/nginx.conf` | Proxies `/uploads/*` to MinIO for serving |

### Storage Details

- **Bucket**: `survey-uploads` (created automatically on startup via `minio-init` container)
- **Access policy**: Public read (download) — anyone can view uploaded images via URL
- **File naming**: UUID v4 + extension (e.g., `82b095d7-d87f-4311-996e-af433da7aeee.png`)
- **Persistence**: Docker volume `minio_data` survives container restarts
- **Max size**: 5MB per file
- **Allowed types**: JPEG, PNG, GIF, WebP

### Flow: Participant Uploads an Image Answer

```
1. Participant sees "Image Upload" question type
   ┌──────────────────────────────────────────┐
   │                                          │
   │         📷 Click to upload an image      │
   │         JPEG, PNG, GIF, or WebP          │
   │         (max 5MB)                        │
   │                                          │
   └──────────────────────────────────────────┘

2. Participant selects a file → frontend validates:
   - File size ≤ 5MB? No → toast error
   - File type starts with "image/"? No → toast error

3. Upload request:
   POST /api/participant/sessions/{sessionId}/upload
   Headers:
     X-Session-Token: <64-char hex token>  (for anonymous users)
     Content-Type: multipart/form-data
   Body:
     file: <binary image data>

4. Backend processing (ParticipantsManagementService):
   a. SessionTokenMiddleware verifies ownership (authenticated or token)
   b. MediaHandler extracts file from multipart form
   c. StorageClient validates:
      - Size ≤ 5MB
      - MIME type ∈ {image/jpeg, image/png, image/gif, image/webp}
   d. Generates UUID filename: uuid.New().String() + extension
   e. Uploads to MinIO: PutObject("survey-uploads", "uuid.jpg", file)
   f. Returns: { "success": true, "fileUrl": "/uploads/uuid.jpg" }

5. Frontend stores fileUrl as the answer value:
   answers[questionId] = "/uploads/82b095d7-d87f-4311-996e-af433da7aeee.png"

6. Preview displayed:
   ┌──────────────────────────────────────────┐
   │  ┌────────────────────────────────────┐  │
   │  │         [uploaded image]            │  │
   │  └────────────────────────────────────┘  │
   │  ✓ Image uploaded                        │
   │                    [Replace] [Remove]    │
   └──────────────────────────────────────────┘

7. On submit: answer sent as { "value": "/uploads/uuid.jpg" }
```

### Flow: Serving Uploaded Images

```
Browser requests: GET /uploads/82b095d7-d87f-4311-996e-af433da7aeee.png

Nginx config:
  location /uploads/ {
      proxy_pass http://minio/survey-uploads/;
      expires 30d;
      add_header Cache-Control "public, immutable";
      add_header X-Content-Type-Options "nosniff";
  }

Nginx rewrites → GET http://minio:9000/survey-uploads/82b095d7-...png
MinIO serves the file → 30-day browser cache
```

### Flow: Conductor Views Image in Results

```
Results page detects answer starts with "/uploads/"
  → Renders <img> thumbnail (max-height 48px) with click-to-expand link
  → Full URL constructed: {PARTICIPANTS_SERVICE_URL}/uploads/uuid.jpg
  → In Docker: nginx proxies to MinIO transparently
```

### Why MinIO Instead of Local Filesystem

| Aspect | Local Filesystem (old) | MinIO (current) |
|--------|----------------------|-----------------|
| Knative scale-to-zero | Files lost when pod stops | Files persist independently |
| Multiple pod replicas | Each pod has different files | All pods share same storage |
| Backup | Manual volume backup | S3-compatible tools (mc mirror, rclone) |
| Migration to cloud | Rewrite upload code | Change endpoint URL (same S3 API) |

---

## 3. Anonymous Survey Taking Without Abuse

### Problem

Anonymous surveys need to be accessible without login, but this opens attack vectors:
- Spam: one person submitting hundreds of responses
- Flooding: bot scripts hammering the start endpoint
- Users don't trust giving their email for "anonymous" surveys

### Design Principle

**Truly anonymous = zero personal data collected.** No email, no device ID, no IP logging. Users must trust that their response cannot be traced back to them.

### Architecture

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│ Browser   │────▶│ CAPTCHA       │────▶│ Session Creation  │
│           │     │ (Turnstile)   │     │ (no identity)     │
└──────────┘     └───────────────┘     └──────────────────┘
                                              │
                                     ┌────────▼────────┐
                                     │ Cookie Dedup     │
                                     │ (7-day, client)  │
                                     └─────────────────┘
```

### Two Layers of Protection

**Layer 1: CAPTCHA (Cloudflare Turnstile)**
```
When anonymous user opens share link:
  1. Turnstile widget renders (one-click, no image puzzles)
  2. Cloudflare verifies: real browser, human behavior
  3. Returns token to frontend
  4. User clicks "Continue to Survey"

This proves:
  - The user is human (not a bot script)
  - The request comes from a real browser
  - Privacy-friendly: Cloudflare doesn't track users
  - Campus WiFi safe: no IP-based checks
```

**Layer 2: Cookie-Based Deduplication**
```
When user starts the survey:
  1. Browser cookie set: survey_submitted_{surveyId}=1 (7-day expiry)
  2. On next visit, cookie detected → "Already submitted" message

This prevents:
  - Casual duplicate submissions (99% of cases)
  - Same browser, same survey → blocked for 7 days

Limitations (acceptable for surveys):
  - Incognito mode = fresh cookie = can resubmit
  - Clearing cookies = can resubmit
  - Different browser = can resubmit
  - These are acceptable because surveys collect opinions, not exam answers
```

### Why NOT IP Rate Limiting

```
Campus WiFi scenario:
  200 students on same WiFi → same public IP: 103.21.58.1
  IP rate limit of 10/10min → only 10 students can start
  The other 190 get "Too many requests" → BROKEN

Solution: No IP rate limiting on survey start endpoint.
CAPTCHA + cookie is sufficient for surveys.
```

### Why NOT Email/OTP

```
User perspective:
  "This says anonymous but asks for my email?"
  → Users don't trust it → lower response rates
  → Defeats the purpose of anonymous surveys

Our approach:
  "Please verify you're human. No personal data is collected."
  → One click CAPTCHA → straight to survey
  → User trusts the process → higher response rates
```

### Complete Anonymous Flow

```
Step 1: Open Share Link
  Browser → GET /survey/public/{shareToken}
  Frontend validates token with SurveyManagementService

Step 2: Cookie Check
  Check: does cookie "survey_submitted_{surveyId}" exist?
  ├─ Yes → "You have already submitted this survey" (error page)
  └─ No  → Continue to CAPTCHA

Step 3: CAPTCHA Verification
  ┌──────────────────────────────────────────┐
  │  📋 Survey Title                          │
  │                                          │
  │  Please verify you're human to continue. │
  │  No personal data is collected.          │
  │                                          │
  │        ┌──────────────────┐              │
  │        │ ☑ I'm human      │ ← Turnstile │
  │        └──────────────────┘              │
  │                                          │
  │  [ Continue to Survey ]                  │
  │                                          │
  │  This survey is completely anonymous.    │
  │  We do not collect your email, device    │
  │  info, or IP address.                    │
  └──────────────────────────────────────────┘

  Cloudflare Turnstile verifies in background.
  "Continue to Survey" button enabled on success.

Step 4: Start Session
  POST /api/participant/surveys/public/start?token={shareToken}
  Body: {} (no email, no personal data)

  Frontend sets cookie: survey_submitted_{surveyId}=1 (7-day expiry)

  Backend:
  a. Token validation with SurveyManagementService
  b. Create session with:
     - participant_id: 0 (anonymous)
     - participant_email: "" (empty — truly anonymous)
     - session_token: <64-char random hex>
     - No browser/device/IP tracking
     - No access log entry created
  c. Return session + survey data + session_token

Step 5: Take Survey
  Session token stored in browser sessionStorage
  All subsequent API calls include X-Session-Token header
  Auto-save drafts every 30 seconds
  No tab switch tracking (anonymous privacy)
  No device fingerprinting (anonymous privacy)

Step 6: Submit
  POST /api/participant/sessions/{id}/submit
  Headers: X-Session-Token: <token>
  Body: { "answers": [...], "completedAt": "..." }

  Backend:
  - Validates session token (constant-time comparison)
  - Saves answers, marks session COMPLETED, deletes draft
  - No identity linked to submission

Step 7: Results
  Redirect to quiz results page (if quiz) or completion page
  Session token used for authentication
  Results shown with auto-graded + pending evaluation badges
```

### What Each Layer Prevents

| Attack | CAPTCHA (Turnstile) | Cookie Dedup |
|--------|:---:|:---:|
| Bot flooding (1000 requests/sec) | ✅ Blocked (not human) | — |
| Automated scripts | ✅ Blocked (no real browser) | — |
| Same person submits twice (same browser) | — | ✅ Blocked (cookie) |
| Same person, incognito mode | ✅ Still needs CAPTCHA | ❌ Fresh cookie |
| 200 students on same campus WiFi | ✅ Each passes independently | ✅ Each has own cookie |

### Data Stored for Anonymous vs Authenticated Users

| Field | Anonymous | Authenticated |
|-------|-----------|---------------|
| participant_email | empty | `user@example.com` |
| browser_name | empty | Chrome 146 |
| os_name | empty | macOS |
| device_type | empty | desktop |
| ip_address | empty | 192.168.1.5 |
| tab_switch_count | not tracked | tracked |
| access_log_entry | not created | created |
| session_token | 64-char hex (required) | optional |
| participant_id | 0 | user's participant ID |

### For Organization-Restricted Surveys

When `allowed_domains` is set (e.g., `@college.edu`), the flow is different — uses OTP instead of CAPTCHA:

```
Open share link → Enter organization email → Domain validated →
6-digit OTP sent → Verify OTP → Email hashed (SHA-256) → Start survey →
Max attempts tracked by hash
```

This is appropriate because:
- Organization surveys are not fully anonymous (domain-restricted)
- OTP proves the user belongs to the organization
- Email is hashed, not stored raw

### Configuration Options (Per Survey)

| Setting | Effect on Anonymous Flow |
|---------|-------------------------|
| `allow_anonymous: true` | Enables CAPTCHA-based anonymous access |
| `password: "exam2026"` | Additional password step after CAPTCHA |
| `allowed_domains: "college.edu"` | Switches to OTP flow (not CAPTCHA) |
| `participant_fields: [name, roll_no]` | Collected after CAPTCHA, before survey |
