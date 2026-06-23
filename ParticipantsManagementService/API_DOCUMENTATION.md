# Participants Management Service - Complete API Documentation

## Overview

The Participants Management Service handles survey-taking functionality, including:
- Starting and resuming survey sessions
- Auto-saving draft answers  
- Submitting final survey responses
- Managing participant survey progress

**Base URL:** `http://localhost:8081`

---

## Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Data Models](#data-models)
4. [Error Codes](#error-codes)
5. [Usage Examples](#usage-examples)

---

## Authentication

All participant endpoints (except `/health`) require authentication via:
- **Bearer Token** in Authorization header
- **Cookie-based** authentication from AuthService

The authenticated user must be registered as a **Participant** in the AuthService.

### Required Header
```
Authorization: Bearer <your_jwt_token>
```

OR

```
Cookie: accessToken=<your_token>
```

---

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Description:** Check if the service is running

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "message": "Participants service is running"
}
```

---

### 2. Start or Resume Survey Session

**Endpoint:** `POST /api/participant/surveys/:surveyId/session`

**Description:** 
- Creates a new survey session if one doesn't exist
- Resumes an existing IN_PROGRESS session
- Returns session details, any saved draft answers, and survey questions

**Authentication:** Required (Participant)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| surveyId | integer | ID of the survey to start/resume |

**Response (200 OK):**
```json
{
  "session": {
    "id": 1,
    "survey_id": 5,
    "participant_id": 3,
    "last_question_id": null,
    "session_status": "IN_PROGRESS",
    "created_at": "2025-11-13T15:30:00Z",
    "updated_at": "2025-11-13T15:30:00Z"
  },
  "draft": {
    "id": 1,
    "session_id": 1,
    "last_answered_question_id": 2,
    "draft_answers_content": {
      "1": "My answer to question 1",
      "2": [1, 3]
    },
    "last_saved": "2025-11-13T15:35:00Z",
    "created_at": "2025-11-13T15:31:00Z",
    "updated_at": "2025-11-13T15:35:00Z"
  },
  "survey": {
    "id": 5,
    "title": "Customer Satisfaction Survey",
    "description": "Help us improve our service",
    "questions": [
      {
        "id": 1,
        "question_text": "How satisfied are you?",
        "question_type": "multiple-choice",
        "mandatory": true,
        "correct_answers": "Very Satisfied,Satisfied,Neutral,Dissatisfied"
      },
      {
        "id": 2,
        "question_text": "Additional feedback",
        "question_type": "text",
        "mandatory": false
      }
    ],
    "is_self_recruitment": true,
    "status": "PUBLISHED"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid survey ID or participant ID missing
- `500 Internal Server Error` - Failed to create/retrieve session

---

### 3. Get Session Information

**Endpoint:** `GET /api/participant/surveys/:surveyId/session`

**Description:** Retrieves the current session for a survey and participant (same as start/resume but explicit GET)

**Authentication:** Required (Participant)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| surveyId | integer | ID of the survey |

**Response:** Same as Start/Resume endpoint

---

### 4. Save Draft Answers

**Endpoint:** `PUT /api/participant/sessions/:sessionId/draft`

**Description:** 
- Auto-saves participant's current answers
- Updates progress tracking (last question answered)
- Creates or updates draft record

**Authentication:** Required (Participant)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | integer | ID of the survey session |

**Request Body:**
```json
{
  "lastQuestionId": 5,
  "draftAnswers": {
    "1": "Answer to question 1",
    "2": [2, 4],
    "3": 5,
    "4": "Partial answer...",
    "5": {"rating": 4, "comment": "Good"}
  }
}
```

**Field Descriptions:**
- `lastQuestionId` (optional): ID of the last question the participant viewed/answered
- `draftAnswers` (required): Map of question IDs to answer values
  - Keys: Question IDs as strings
  - Values: Can be string, number, array, or object depending on question type

**Response (200 OK):**
```json
{
  "message": "Draft saved successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid session ID or request body
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Failed to save draft

---

### 5. Submit Final Survey Answers

**Endpoint:** `POST /api/participant/sessions/:sessionId/submit`

**Description:**
- Submits final answers for the survey
- Marks session as COMPLETED
- Deletes the draft
- Transaction-based for data integrity

**Authentication:** Required (Participant)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| sessionId | integer | ID of the survey session |

**Request Body:**
```json
{
  "answers": [
    {
      "questionId": 1,
      "responseData": "Very Satisfied"
    },
    {
      "questionId": 2,
      "responseData": [2, 4, 5]
    },
    {
      "questionId": 3,
      "responseData": {
        "rating": 5,
        "comment": "Excellent service!"
      }
    }
  ]
}
```

**Field Descriptions:**
- `answers` (required): Array of answer objects
  - `questionId` (required): ID of the question being answered
  - `responseData` (required): The answer value (type depends on question type)

**Response (200 OK):**
```json
{
  "message": "Survey submitted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid session ID or request body
- `404 Not Found` - Session not found
- `409 Conflict` - Session is not IN_PROGRESS (already submitted or abandoned)
- `500 Internal Server Error` - Failed to submit survey

---

## Data Models

### Survey Session

Represents a participant's attempt to complete a survey.

```typescript
interface SurveySession {
  id: number;                    // Unique session identifier
  survey_id: number;             // Survey being taken
  participant_id: number;        // Participant taking survey
  last_question_id?: number;     // Last question viewed/answered
  session_status: SessionStatus; // Current status
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}

type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
```

### Participant Survey Draft

Auto-saved progress during survey taking.

```typescript
interface ParticipantSurveyDraft {
  id: number;                        // Unique draft identifier
  session_id: number;                // Associated session
  last_answered_question_id?: number;// Last answered question
  draft_answers_content: DraftAnswers; // Saved answers
  last_saved: string;                // ISO timestamp
  created_at: string;                // ISO timestamp
  updated_at: string;                // ISO timestamp
}

interface DraftAnswers {
  [questionId: string]: any; // Question ID -> Answer value
}
```

### Answer

Final submitted answer to a question.

```typescript
interface Answer {
  id: number;              // Unique answer identifier
  session_id: number;      // Session this answer belongs to
  question_id: number;     // Question being answered
  response_data: any;      // Answer value (JSONB)
  created_at: string;      // ISO timestamp
  updated_at: string;      // ISO timestamp
}
```

---

## Error Codes

| HTTP Code | Error Type | Description |
|-----------|------------|-------------|
| 400 | Bad Request | Invalid input parameters or malformed request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User doesn't have required permissions |
| 404 | Not Found | Resource (session/draft) not found |
| 409 | Conflict | Operation conflict (e.g., submitting completed session) |
| 500 | Internal Server Error | Unexpected server error |

---

## Usage Examples

### Complete Survey Flow

```javascript
// 1. Start/Resume Survey
const startResponse = await fetch(
  'http://localhost:8081/api/participant/surveys/5/session',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
const { session, draft, survey } = await startResponse.json();

// 2. Save Draft (Auto-save as user progresses)
const saveDraftResponse = await fetch(
  `http://localhost:8081/api/participant/sessions/${session.id}/draft`,
  {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      lastQuestionId: 2,
      draftAnswers: {
        '1': 'Very Satisfied',
        '2': [2, 4]
      }
    })
  }
);

// 3. Submit Final Answers
const submitResponse = await fetch(
  `http://localhost:8081/api/participant/sessions/${session.id}/submit`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      answers: [
        { questionId: 1, responseData: 'Very Satisfied' },
        { questionId: 2, responseData: [2, 4, 5] },
        { questionId: 3, responseData: { rating: 5, comment: 'Great!' } }
      ]
    })
  }
);
```

### cURL Examples

**Start Survey:**
```bash
curl -X POST http://localhost:8081/api/participant/surveys/5/session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Save Draft:**
```bash
curl -X PUT http://localhost:8081/api/participant/sessions/1/draft \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lastQuestionId": 2,
    "draftAnswers": {
      "1": "Answer 1",
      "2": [1, 3]
    }
  }'
```

**Submit Survey:**
```bash
curl -X POST http://localhost:8081/api/participant/sessions/1/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId": 1, "responseData": "Answer 1"},
      {"questionId": 2, "responseData": [1, 3]},
      {"questionId": 3, "responseData": 5}
    ]
  }'
```

---

## Database Tables

### survey_sessions
Tracks participant survey attempts

| Column | Type | Description |
|--------|------|-------------|
| session_id | SERIAL | Primary key |
| survey_id | INTEGER | FK to surveys |
| participant_id | INTEGER | FK to participants |
| last_question_id | INTEGER | Progress tracker |
| session_status | VARCHAR | IN_PROGRESS/COMPLETED/ABANDONED |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### participant_survey_drafts
Auto-saved progress

| Column | Type | Description |
|--------|------|-------------|
| participant_draft_id | SERIAL | Primary key |
| session_id | INTEGER | FK to survey_sessions (unique) |
| last_answered_question_id | INTEGER | Last question answered |
| draft_answers_content | JSONB | Saved answers |
| last_saved | TIMESTAMP | Last save time |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### answers
Final submitted answers

| Column | Type | Description |
|--------|------|-------------|
| answer_id | SERIAL | Primary key |
| session_id | INTEGER | FK to survey_sessions |
| question_id | INTEGER | Question being answered |
| response_data | JSONB | Answer value |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

---

## Session States

```
┌─────────────┐
│   START     │
└──────┬──────┘
       │
       v
┌─────────────┐      Save Draft (auto)      ┌─────────────┐
│ IN_PROGRESS │◄────────────────────────────►│   DRAFT     │
└──────┬──────┘                              └─────────────┘
       │
       │ Submit
       v
┌─────────────┐
│  COMPLETED  │
└─────────────┘
```

---

## Notes

1. **Draft Auto-Save**: Recommended to save drafts every 30-60 seconds or on question navigation
2. **Session Resumption**: Users can close and resume surveys - draft is automatically loaded
3. **Transaction Safety**: Survey submission uses database transactions for integrity
4. **Answer Types**: `responseData` can be string, number, array, or object (stored as JSONB)
5. **Mock Survey Data**: Currently returns mock survey questions - will integrate with Survey Management Service

---

## Status Codes Quick Reference

| Endpoint | Success | Client Error | Server Error |
|----------|---------|--------------|--------------|
| POST /surveys/:id/session | 200 | 400 | 500 |
| GET /surveys/:id/session | 200 | 400, 404 | 500 |
| PUT /sessions/:id/draft | 200 | 400, 404 | 500 |
| POST /sessions/:id/submit | 200 | 400, 404, 409 | 500 |

---

## Summary

✅ **5 Total Endpoints**
- 1 Health check
- 4 Participant survey-taking endpoints

✅ **Features:**
- Session management (start/resume)
- Auto-save drafts
- Final submission with transaction safety
- Progress tracking

✅ **Next Steps for Integration:**
1. Replace mock survey data with actual Survey Management Service calls
2. Add participant validation
3. Implement survey media file uploads
4. Add session analytics/reporting

