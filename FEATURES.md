# Survey Platform — Feature Overview

A self-hosted, open-source platform for creating surveys, conducting quizzes, and managing evaluations. Built for educational institutions and organizations that need full control over their data with zero recurring costs.

---

## Platform Overview

Survey Platform is a general-purpose tool that handles both **simple surveys** (feedback, polls, research) and **full-featured exams** (timed quizzes, code assessments, manual grading). It runs on your own infrastructure using a serverless architecture that scales to zero when idle and auto-scales during peak usage.

### Architecture

- **4 microservices**: Auth (.NET), Survey Management (Go/Fiber), Participants Management (Go/Fiber), Frontend (Next.js)
- **Serverless deployment**: Knative on Kubernetes with scale-to-zero
- **Object storage**: MinIO (S3-compatible, self-hosted)
- **Database**: PostgreSQL
- **Code execution**: Piston engine (50+ programming languages, sandboxed)
- **API Gateway**: Nginx-based smart proxy with path routing
- **Local development**: Docker Compose (single command setup)

---

## Complete Feature List

### Survey Creation & Authoring

**Six Question Types**

- **Single choice** — radio button cards with visual selection
- **Multiple choice** — checkbox cards with multi-select
- **Free text** — textarea with character count
- **Star rating** — 1–5 scale with hover effects and labels (Poor/Fair/Good/Very Good/Excellent)
- **Code editor** — in-browser IDE with syntax highlighting, multi-language support, test case definitions, and starter code templates
- **Image upload** — drag-and-drop with preview, replace, and remove (5MB max, JPEG/PNG/GIF/WebP)

**Quiz Configuration**

- Time limit (minutes) with countdown timer and auto-submit on expiry
- Passing score percentage (determines pass/fail)
- Show or hide correct answers after completion
- Maximum attempts per participant (unlimited or capped)
- Question shuffling (randomize order to prevent copying)
- Option shuffling (randomize answer choices)
- Manual evaluation flag (conductor must grade certain question types)
- Points per question (configurable, default 1)
- Correct answers for auto-gradable types (single/multiple choice)
- Explanation text shown after quiz completion

**Per-Question Settings**

- Mandatory flag (must answer to proceed)
- Points value
- Correct answer specification (for MCQ types)
- Explanation/rationale text
- Media attachments (image uploads on questions)
- Code settings: allowed languages, default language, starter code per language, test cases with input/expected output, hidden vs visible tests

**Custom Participant Fields**

- Conductor defines fields to collect before the survey (name, email, roll number, department, phone, etc.)
- Configurable type per field (text, email, number, tel)
- Required or optional per field
- Up to 20 custom fields per survey
- Auto-filled from participant profile for registered users

**Quiz Template Import from Excel**

- Download pre-formatted Excel template
- Bulk import questions with: text, type, options (A–Y), correct answers, points, explanations, mandatory flag
- Supports .xlsx, .xls, .csv files

**Draft System**

- Auto-saves every few seconds to localStorage and server
- Resume editing from any device
- Publish when ready — drafts don't affect live surveys
- Backup draft recovery on failure

**Edit Published Surveys**

- Load any published survey back into the editor
- Modify questions, options, settings, participant fields
- Republish to update — new participants see updated questions
- Existing completed responses preserved

**Survey Preview**

- Conductors can preview their survey exactly as participants see it
- No session created, no data recorded
- Purple "Preview Mode" banner with exit button
- Timer disabled, auto-save disabled, submission disabled

---

### Survey Distribution & Access Control

**Three Distribution Modes**

1. **Public Share Link (Anonymous)** — anyone with the link can take the survey
   - Cloudflare Turnstile CAPTCHA (proves human, no puzzles, privacy-friendly)
   - Cookie-based dedup (7-day cookie prevents casual re-submissions)
   - Zero personal data collected — no email, no device tracking, no IP logging
   - Optional password protection
   - Campus WiFi safe — no IP-based rate limiting (shared IPs don't cause blocks)
   - Access logs disabled for anonymous users (privacy)

2. **Organization-Restricted** — email domain restriction
   - Allowed domains configurable (e.g., @college.edu, @company.com)
   - OTP email verification against allowed domains
   - Domain validation before OTP is sent
   - Email hashed with SHA-256 for privacy

3. **Invitation-Only** — bulk email invitations with unique tokens
   - Per-recipient unique invitation token
   - Status tracking: sent, clicked, completed
   - Resend failed invitations
   - Invitation statistics dashboard
   - Full access logging

**Sharing Settings**

- Unique share token per survey
- Active/inactive toggle
- Expiration date (optional)
- Maximum response cap (optional)
- Allow anonymous responses toggle

**Access Security**

- Session tokens (64-char cryptographic hex) for anonymous participants
- Constant-time comparison prevents timing attacks
- IDOR prevention — every session endpoint verifies ownership
- CAPTCHA verification for anonymous surveys (Cloudflare Turnstile)
- OTP verification for organization-restricted surveys (6-digit code, 10-minute expiry)
- Piston code execution rate limited (5/min per IP in nginx)

---

### Survey Taking Experience

**Participant Flow**

1. Access survey via share link, invitation, or authenticated browse
2. CAPTCHA verification (for anonymous access) or OTP (for organization-restricted)
3. Custom participant field collection (if configured)
4. Intro screen with survey title, description, question count, and time limit
5. One question per page with progress bar
6. Navigate forward/backward through questions
7. Auto-save draft every 30 seconds
8. Submit with mandatory question validation
9. Redirect to results (quiz) or completion page (survey)

**During Survey Taking**

- Progress bar showing current position
- Question type badge (Single Choice, Multiple Choice, Text, Rating, Code, Image Upload)
- Required question indicator with validation message
- Save & Exit button for manual draft save
- Resume from where you left off (draft restored on return)

**Quiz-Specific Features**

- Countdown timer visible throughout (color-coded: green/yellow/red)
- "Quiz Mode" badge in header
- Auto-submit when time expires (all answers preserved)
- Tab switch detection (logs every time participant leaves the quiz tab)

**Code Editor Features (During Quiz)**

- Syntax-highlighted editor with language selection
- Run code with custom stdin input
- Run test cases (visible ones) with pass/fail results
- Starter code templates per language
- Output display: stdout, stderr, exit code

---

### Quiz Evaluation & Grading

**Auto-Grading (Instant)**

- Single choice: direct option comparison
- Multiple choice: set comparison (order-independent)
- Text: case-insensitive string comparison
- Points calculated per question
- Overall score, percentage, and pass/fail determined

**Server-Side Code Execution**

- Participant's code executed against test cases via Piston engine
- Each test case: run code with input, compare stdout to expected output
- Test summary: "X/Y test cases passed"
- Full points if all test cases pass
- Marked as pending evaluation if any test fails (for manual review/partial credit)

**Manual Evaluation (Conductor Grading)**

- Required for: text (without answer key), rating, image-upload, code (partial credit)
- Inline marks editing directly in the results page
- Editable number input per question per student
- Batch save all marks with one click
- Optional feedback per question
- Re-grade at any time (not locked after first evaluation)
- Auto-save while grading

**Pending Evaluation Flow**

- After quiz submission, auto-graded questions show results immediately
- Manually-graded questions show "Pending Evaluation" badge with clock icon
- Blue info banner: "Some questions are pending evaluation"
- Code questions show: submitted code (syntax-highlighted), language, test case summary
- Participant told: "This question will be graded by your instructor"
- Once conductor grades → participant can revisit and see final marks

---

### Results & Analytics

**Participant Quiz Results Page**

- Overall score percentage with pass/fail header
- Stats cards: points earned, correct count, incorrect count, time taken
- Performance progress bar
- Per-question breakdown:
  - Auto-graded: green (correct) or red (incorrect) card with your answer vs correct answer
  - Pending evaluation: blue card with "Pending Evaluation" badge
  - Code questions: syntax-highlighted code block, language, test summary
  - Explanation text (if provided by conductor)
  - Instructor feedback (if graded)

**Conductor Results Dashboard**

- Summary cards: total responses, completed, in progress, average score, pass rate
- Per-participant row: email, status, score, percentage, time taken, device info, tab switches
- Expandable detail view per participant: all answers, participant info, device/browser info
- Tab switch warning badge (orange) for quiz participants
- Image thumbnails for image-upload answers
- Star display for rating answers
- Anonymous participants shown as "Anonymous #1", "Anonymous #2" (privacy)

**Analytics Dashboard (Real-Time, Auto-Refresh Every 30s)**

Quiz charts:

- Score Distribution (histogram: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
- Pass/Fail breakdown (pie chart)
- Question Difficulty (horizontal bar, % correct per question, sorted hardest first)
- Tab Switches distribution (bar chart: 0, 1-2, 3-5, 5+)

Survey charts:

- Completion Funnel (started → completed → in progress)
- Responses per Question (horizontal bar)

Both:

- Time Taken distribution (0-5m, 5-10m, 10-20m, 20-30m, 30m+)
- Responses Over Time (submissions per day)
- Device Breakdown (pie: desktop/mobile/tablet)

Collapsible section, dynamically imported (no SSR issues).

**Inline Marks Editing**

- Edit points per question per student directly in the results page
- Changes reflected immediately in UI and Excel export
- "Save Marks" button (shows * when unsaved edits exist)
- "Save & Notify Participant" button — saves marks and sends email
- Disabled for anonymous participants (shows "Anonymous — No Email")

**Excel Export (3-Sheet Workbook)**

- **Marks sheet**: One row per student, one column per question showing marks earned. MAX MARKS row at top. Includes: total score, max score, percentage, pass/fail, tab switches, time taken, started at, completed at.
- **Answers sheet**: Full answer text per question per student (including image URLs for upload questions).
- **Question Key sheet**: Maps Q1, Q2, etc. to full question text, type, and max marks.
- Filename: `{Survey Title}-results-{date}.xlsx`

**Email Result Notifications**

- Send evaluation results to participant via email after grading
- Email includes: survey title, score, percentage, pass/fail status
- Question-by-question breakdown with marks and feedback
- Triggered per participant from the results page
- Sent via SMTP through SurveyManagementService (secured with internal API key)

---

### Participant Dashboard

- Profile section: name, email, roll number, phone, custom fields
- Edit profile: update name, phone, add/remove custom fields
- Stats cards: total surveys, in-progress, completed
- In-progress surveys: resume button to continue where you left off
- Completed surveys: expandable cards showing:
  - Survey title, completion date, time taken, attempt number
  - Quiz badge and pass/fail status
  - Score percentage and points breakdown
  - "View Details" button → quiz results page
- Attempt history with best score tracking

### Conductor Dashboard

- Stats cards: total surveys, drafts, published, total responses
- Survey list with status badges (DRAFT, PUBLISHED)
- Quiz badge, manual grading badge, pending evaluation count
- Action buttons per survey:
  - **Preview** (purple eye) — preview as participant
  - **Edit** (blue pencil) — load into editor for modification
  - **Results** (bar chart) — analytics and results dashboard
  - **Share/Distribute** (share icon) — sharing settings and invitations
  - **Evaluate** (clipboard) — pending manual evaluations
  - **Delete** (trash) — with confirmation dialog
- Switch to Participant view (redirects to register if not yet a participant)
- Create Survey button → opens editor

---

### Anti-Cheating & Integrity

- **Tab switch detection**: logs every time participant leaves the quiz tab during a timed quiz
- Tab switch count displayed per participant in results and Excel export
- **Device/browser/IP tracking**: captured per submission for authenticated users (not for anonymous — privacy)
- **Question shuffling**: randomize question order to prevent screen-sharing
- **Option shuffling**: randomize answer choices per question
- **CAPTCHA (Cloudflare Turnstile)**: proves human for anonymous surveys, no puzzles, privacy-friendly
- **Cookie-based dedup**: 7-day cookie prevents casual re-submissions on anonymous surveys
- **OTP email verification**: for organization-restricted surveys (domain-validated)
- **Session tokens**: 64-char hex tokens with constant-time comparison
- **Max attempts enforcement**: tracked per authenticated user or invitation
- **Campus WiFi safe**: no IP-based rate limiting on survey access (shared campus IPs don't cause blocks)

---

### Security

**Authentication & Authorization**

- JWT authentication with role-based access (Conductor, Participant, Admin)
- 1-hour token expiry with auto-refresh at 55 minutes
- Conductor ID verified on all survey management endpoints
- Participant ownership verified on all session endpoints

**API Security**

- Piston code execution: rate limited (5 per IP per minute, burst of 3)
- Email send endpoint: requires internal API key header
- CAPTCHA required for anonymous survey access (Cloudflare Turnstile)
- Internal service-to-service calls: X-Internal-API-Key header validation

**Container Security**

- Read-only root filesystem on all pods
- Non-root user execution (UID 1000-1001)
- All Linux capabilities dropped
- Seccomp RuntimeDefault profile enforced
- CSRF token protection on frontend API calls

**Network Isolation**

- Piston code execution engine on isolated Docker network (`piston_net`)
- Only nginx and participants-service can reach Piston
- Auth service, survey service, frontend, postgres, MinIO cannot access Piston
- Prevents compromised services from using Piston as compute

**Data Privacy (Anonymous Users)**

- Zero personal data collected — no email, no name, no device info, no IP
- No browser/device/IP tracking for anonymous sessions
- No access logs for anonymous users
- CAPTCHA token is ephemeral (verified once, not stored)
- Cookie-based dedup only (client-side, no server-side tracking)
- Truly anonymous — even the platform operator cannot identify who submitted

---

### Deployment & Operations

**Local Development**

- `docker compose up -d` starts the entire platform
- 8 services: nginx, postgres, MinIO, auth, survey, participants, frontend, piston
- MinIO console at `localhost:9001` for inspecting uploaded files
- All services with health checks and dependency ordering

**Production Deployment (Knative Serverless)**

- Scale-to-zero: services shut down when idle, cold-start on first request
- Auto-scaling: configurable max replicas per service (10-15)
- API gateway (nginx smart-proxy) with path-based routing to all Knative services via Kourier
- MinIO with persistent volume for media storage
- PostgreSQL with persistent volume
- ConfigMaps for environment-specific configuration
- Secret templates with `envsubst` for credential injection
- Database migration jobs (separate from application startup)
- Health probes: liveness, readiness, and startup on all services
- Domain mapping for custom URLs

**CI/CD Pipeline (GitHub Actions)**

- Automated builds on push to main
- Per-service change detection (only rebuilds what changed)
- Docker images pushed to GitHub Container Registry (ghcr.io)
- Immutable image tags using commit SHA
- Automated Knative service updates via `kn service update`
- Infrastructure deployment (MinIO, API gateway) when infra files change
- Post-deployment health checks

---

## Complete Flows

### Flow 1: Survey Creation → Publishing

```
Conductor logs in
  → Dashboard shows existing surveys
  → Click "Create Survey"
  → Basic Info: title, description, quiz toggle, timer, passing score, shuffling, max attempts
  → Add Questions: choose type, set options, correct answers, points, explanation, media
  → For code questions: select languages, add starter code, define test cases
  → Custom Participant Fields: define name/email/roll_no/etc.
  → Draft auto-saves to localStorage + server every few seconds
  → Click "Publish" → survey goes live
  → Redirect to dashboard
```

### Flow 2: Edit Published Survey

```
Conductor dashboard
  → Click blue pencil (Edit) on a published survey
  → Survey loaded from API into editor (questions, options, settings, participant fields)
  → Modify anything: add/remove questions, change options, update settings
  → Click "Publish" → existing survey UPDATED (new question IDs created)
  → Existing completed responses preserved
  → New participants see updated questions
```

### Flow 3: Survey Distribution (Share Link)

```
Conductor goes to Distribute page
  → Enable sharing → unique share link generated
  → Optional: set password, expiration, max responses, allowed domains
  → Copy share link → send to participants
  → Or: bulk email invitations (paste emails or upload CSV)
  → Track invitation status: sent, clicked, completed
```

### Flow 4: Anonymous Survey Taking (Share Link)

```
Participant opens share link
  → Cookie check: "survey_submitted_{id}" cookie exists?
      Yes → "You have already submitted this survey" (soft block)
      No  → Continue
  → CAPTCHA: Cloudflare Turnstile widget (one-click, no puzzles)
      "Please verify you're human. No personal data is collected."
  → Pass CAPTCHA → "Continue to Survey" button enabled
  → (If password-protected: enter password)
  → Custom participant fields collected (if configured)
  → Intro screen: title, description, question count, time limit
  → Click "Start" → dedup cookie set (7-day expiry)
  → Answer questions one by one with progress bar
  → Auto-save every 30 seconds (no email/identity attached)
  → For code questions: write code, run tests, see results
  → For image upload: upload photo, preview, replace
  → Submit → mandatory validation → confirmation dialog
  → Quiz: redirect to results page with auto-graded scores + pending badges
  → Survey: redirect to completion page

Privacy: zero personal data stored. No email, no device info, no IP.
The only thing linking the user to their submission is the session token
(random 64-char hex, stored in browser sessionStorage, not tied to identity).
```

### Flow 4b: Organization-Restricted Survey Taking

```
Participant opens share link
  → Email verification: enter organization email (@college.edu)
      → Domain validated against allowed list
      → 6-digit OTP sent to email
      → Verify OTP (3 attempts, 10-minute expiry)
  → (If password-protected: enter password)
  → Email hashed (SHA-256) and stored for attempt tracking
  → Same survey taking flow as anonymous
  → Max attempts enforced by email hash
```

### Flow 5: Authenticated Survey Taking

```
Participant logs in → Dashboard
  → Browse available surveys or click shared link
  → Role check: must have "Participating" role
  → Session created (or resumed if in-progress)
  → Same taking flow as anonymous but with:
    - Browser/device/IP tracking
    - Full email stored (not hashed)
    - Profile auto-fill for participant fields
    - Tab switch detection for quizzes
```

### Flow 6: Quiz Results (Participant View)

```
After quiz submission
  → Redirect to /survey/quiz-results/{sessionId}
  → Backend evaluates:
    - MCQ: auto-graded instantly (correct/incorrect + points)
    - Code: executed server-side via Piston, test cases compared
    - Text/Rating/Image: marked as "Pending Evaluation"
  → Participant sees:
    - Overall score, percentage, pass/fail
    - Green cards: correct auto-graded questions
    - Red cards: incorrect auto-graded questions
    - Blue cards: "Pending Evaluation" for manually-graded questions
    - Code: syntax-highlighted code + test summary
    - Banner: "Some questions are pending evaluation"
  → After conductor grades:
    - Revisit results page → pending questions now show marks + feedback
```

### Flow 7: Conductor Grading

```
Conductor opens Results page for a quiz
  → Sees all participants with scores
  → Expand a participant → see all answers
  → For auto-graded questions: scores shown (green/red)
  → For manually-graded questions: editable marks input
  → Edit marks per question (number input, clamped to 0–max)
  → Click "Save Marks" → persisted to database
  → Click "Save & Notify Participant" → saves marks + sends email with:
    - Survey title, total score, percentage, pass/fail
    - Per-question breakdown with marks and feedback
  → Analytics dashboard updates in real-time (30s auto-refresh)
  → Export Excel → reflects edited marks
```

### Flow 8: Survey Preview

```
Conductor dashboard
  → Click purple eye (Preview) on a published survey
  → Opens survey in new tab at /survey/take/{id}?preview=true
  → Purple banner: "Preview Mode — No responses are being recorded"
  → Navigate through all questions normally
  → No session created, no data saved, no timer, no tab tracking
  → Click "Exit Preview" → return to dashboard
```

---

## Comparison with Existing Tools


| Capability                                | Survey Platform | Google Forms   | Typeform | Microsoft Forms |
| ----------------------------------------- | --------------- | -------------- | -------- | --------------- |
| Free and open source                      | Yes             | Free (limited) | Paid     | Free (limited)  |
| Self-hosted (own your data)               | Yes             | No             | No       | No              |
| Code execution questions                  | Yes             | No             | No       | No              |
| Server-side test case grading             | Yes             | No             | No       | No              |
| Timed quizzes with auto-submit            | Yes             | No             | No       | Partial         |
| Manual grading with feedback              | Yes             | No             | No       | No              |
| Inline marks editing in results           | Yes             | No             | No       | No              |
| Tab switch detection                      | Yes             | No             | No       | No              |
| Bulk email invitations with tracking      | Yes             | No             | No       | No              |
| Custom participant fields                 | Yes             | No             | No       | No              |
| Image upload as answer                    | Yes             | Yes            | No       | No              |
| AI survey generation                      | Yes             | No             | Paid     | No              |
| Excel export with per-question marks      | Yes             | CSV only       | No       | No              |
| Quiz template import from Excel           | Yes             | No             | No       | No              |
| Multiple attempts with best score         | Yes             | No             | No       | No              |
| Device/browser/IP tracking                | Yes             | No             | No       | No              |
| Real-time analytics dashboard             | Yes             | Yes            | Paid     | Partial         |
| CAPTCHA + cookie dedup (anonymous)        | Yes             | No             | No       | No              |
| OTP email verification (org-restricted)   | Yes             | No             | No       | No              |
| Serverless deployment (scale-to-zero)     | Yes             | N/A            | N/A      | N/A             |
| Piston rate limiting + auth               | Yes             | N/A            | N/A      | N/A             |
| Network-isolated code execution           | Yes             | N/A            | N/A      | N/A             |
| Question and option shuffling             | Yes             | Yes            | No       | Yes             |
| Anonymous and authenticated access        | Yes             | Yes            | Yes      | Yes             |
| Reset participant for retake              | Yes             | No             | No       | No              |
| Email result notifications with breakdown | Yes             | Yes            | No       | Yes             |
| Survey preview mode                       | Yes             | Yes            | Yes      | Yes             |
| Edit published surveys                    | Yes             | Yes            | Yes      | Yes             |


---

## Use Cases

**Academic Exams**

- Programming assessments with code execution and test cases
- MCQ exams with auto-grading, timer, and anti-cheating
- Subjective exams with manual evaluation and feedback
- Lab practical exams with image upload for screenshots or photos of work
- Mixed exams: MCQ (auto-graded) + code (test-case graded) + text (manual)

**Course Feedback**

- Anonymous student feedback surveys with OTP verification
- Rating-based evaluations with text comments
- Custom fields for course and section identification
- Real-time analytics dashboard for administrators

**Recruitment and Assessments**

- Technical screening with coding questions (50+ languages)
- Timed aptitude tests with auto-grading
- Bulk candidate invitations with status tracking
- Anti-cheating: tab switches, device tracking, question shuffling

**Research Surveys**

- AI-generated survey from research topic description
- Anonymous or identified responses
- Excel export for statistical analysis
- Multiple response collection modes (public, org-restricted, invitation-only)

**Event Registration and Feedback**

- Collect attendee information via custom fields
- Post-event satisfaction surveys
- Share link or QR code distribution
- Real-time response monitoring

