package models

import (
	"time"

	"gorm.io/datatypes" // Need this for JSON handling
)

// SurveySession tracks a specific attempt by a participant to take a survey.
// It links the participant, the survey they are taking, and the state of their attempt.
type SurveySession struct {
	// SessionID is the unique identifier for this survey-taking attempt.
	SessionID uint `json:"id" gorm:"primaryKey;column:session_id"`

	// SurveyID identifies the survey being taken. This ID refers to a survey
	// defined in another service (e.g., Survey Management Service).
	SurveyID uint `json:"survey_id" gorm:"column:survey_id;not null;index"` // Index useful for lookups

	// ParticipantID identifies the participant taking the survey. This ID refers
	// to a participant defined in the AuthService. Value of 0 indicates anonymous user.
	ParticipantID uint `json:"participant_id" gorm:"column:participant_id;not null;index"` // Index useful for lookups

	// SessionToken is a cryptographically secure token for session access control.
	// Required for anonymous users to access their session (prevents IDOR attacks).
	SessionToken string `json:"session_token,omitempty" gorm:"column:session_token;type:varchar(64);uniqueIndex"`

	// LastQuestionID tracks the ID of the last question the participant was shown or answered.
	// Useful for resuming. Pointer allows null. Refers to a question defined elsewhere.
	LastQuestionID *uint `json:"last_question_id,omitempty" gorm:"column:last_question_id"`

	// SessionStatus indicates the current state of the survey attempt.
	// Examples: "IN_PROGRESS", "COMPLETED", "ABANDONED"
	SessionStatus string `json:"session_status" gorm:"column:session_status;not null;index"`

	// EvaluationStatus indicates the grading state for quizzes with manual evaluation
	// Values: "auto_graded" (default), "pending_evaluation", "evaluated"
	EvaluationStatus string `json:"evaluation_status" gorm:"column:evaluation_status;default:'auto_graded'"`

	// TotalScore stores the final score after evaluation (manual or auto)
	TotalScore *float64 `json:"total_score,omitempty" gorm:"column:total_score"`

	// MaxScore stores the maximum possible score for this session
	MaxScore *float64 `json:"max_score,omitempty" gorm:"column:max_score"`

	// EvaluatedAt stores when the evaluation was completed
	EvaluatedAt *time.Time `json:"evaluated_at,omitempty" gorm:"column:evaluated_at"`

	// EvaluatedBy stores the conductor ID who evaluated (for manual evaluation)
	EvaluatedBy *uint `json:"evaluated_by,omitempty" gorm:"column:evaluated_by"`

	// AttemptNumber tracks which attempt this is for the participant (1st, 2nd, etc.)
	AttemptNumber int `json:"attempt_number" gorm:"column:attempt_number;default:1"`

	// ParticipantEmail stores the email of the participant (especially for anonymous/guest users)
	// This is populated when starting a session via share link with email validation
	ParticipantEmail string `json:"participant_email,omitempty" gorm:"column:participant_email"`

	// ParticipantInfo stores custom participant data collected via conductor-defined fields
	// Example: {"name":"John Doe","roll_no":"CS2024001","department":"Computer Science"}
	ParticipantInfo datatypes.JSON `json:"participant_info,omitempty" gorm:"column:participant_info;type:jsonb"`

	// Anti-cheating: number of times the participant switched away from the quiz tab
	TabSwitchCount int `json:"tab_switch_count" gorm:"column:tab_switch_count;default:0"`

	// QuizStartedAt records when the participant actually started taking the quiz (clicked "Start"),
	// as distinct from when the session row was created. Used to anchor the timer accurately and
	// for server-side time-limit checks. Null for old sessions → callers fall back to CreatedAt.
	QuizStartedAt *time.Time `json:"quiz_started_at,omitempty" gorm:"column:quiz_started_at"`

	// OverTime flags a submission that arrived after the quiz time limit (set server-side at submit).
	OverTime bool `json:"over_time" gorm:"column:over_time;default:false"`

	// Browser/Device tracking
	UserAgent    string `json:"user_agent,omitempty" gorm:"column:user_agent"`
	BrowserName  string `json:"browser_name,omitempty" gorm:"column:browser_name"`
	BrowserVer   string `json:"browser_version,omitempty" gorm:"column:browser_version"`
	OSName       string `json:"os_name,omitempty" gorm:"column:os_name"`
	DeviceType   string `json:"device_type,omitempty" gorm:"column:device_type"` // desktop, mobile, tablet
	IPAddress    string `json:"ip_address,omitempty" gorm:"column:ip_address"`

	// CreatedAt timestamp for when the session was initiated.
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	// UpdatedAt timestamp for when the session was last updated.
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`

	// --- Relationships ---
	// We don't define struct relationships to Survey or Participant here,
	// as those entities live in other microservices. We only store their IDs.
}

// TableName specifies the corresponding database table name for GORM.
func (SurveySession) TableName() string {
	return "survey_sessions"
}

// --------------------------------------------------------------------------

// Answer stores a participant's final submitted response to a single question
// within a specific survey session.
type Answer struct {
	// AnswerID is the unique identifier for this specific answer record.
	AnswerID uint `json:"id" gorm:"primaryKey;column:answer_id"`

	// SessionID links this answer back to the specific survey session.
	SessionID uint `json:"session_id" gorm:"column:session_id;not null;index"`

	// QuestionID identifies the question being answered. Refers to a question defined elsewhere.
	QuestionID uint `json:"question_id" gorm:"column:question_id;not null;index"`

	// ResponseData contains the actual answer provided by the participant.
	// Using JSON allows flexibility for different answer types (text, selected option IDs, etc.).
	// Example: "My text answer", `[25, 30]`, `5`, `{"rating": 4, "comment": "Good"}`
	// NOTE: Your SQL schema uses `text` for `response_data`. If you intend to store
	// complex data, consider changing the SQL column type to `jsonb`. If it truly
	// is always simple text, change `datatypes.JSON` here to `string`. Assuming JSONB potential.
	ResponseData datatypes.JSON `json:"response_data" gorm:"column:response_data;type:jsonb"` // Or string if SQL is text

	// Justification is the participant-authored reason for a choice answer (anti-cheating).
	// Empty for questions that don't require a justification.
	Justification string `json:"justification" gorm:"column:justification;type:text"`

	// Deprecated fields based on SQL schema (response can be handled by ResponseData)
	// Response *string `json:"response,omitempty" gorm:"column:response"` // Consider removing if ResponseData is used

	// CreatedAt timestamp for when the answer was recorded.
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	// UpdatedAt timestamp for when the answer was last updated (less common for answers).
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`

	// --- Relationships ---
	// SurveySession *SurveySession `json:"-" gorm:"foreignKey:SessionID"` // Optional GORM relationship
}

// TableName specifies the corresponding database table name for GORM.
func (Answer) TableName() string {
	return "answers"
}

// --------------------------------------------------------------------------

// ParticipantSurveyDraft stores the temporary, auto-saved state of a participant's answers
// during an active survey session before final submission.
type ParticipantSurveyDraft struct {
	// ParticipantDraftID is the unique identifier for this draft record.
	ParticipantDraftID uint `json:"id" gorm:"primaryKey;column:participant_draft_id"`

	// SessionID links this draft to a specific survey session attempt.
	// Should be unique as a session only has one active draft.
	SessionID uint `json:"session_id" gorm:"column:session_id;not null;uniqueIndex:uq_psd_session"`

	// LastAnsweredQuestionID tracks the ID of the last question the participant
	// interacted with in this draft. Pointer allows null. Refers to a question defined elsewhere.
	LastAnsweredQuestionID *uint `json:"last_answered_question_id,omitempty" gorm:"column:last_answered_question_id"`

	// DraftAnswersContent stores the participant's answers collected so far as a JSON object.
	// Keys are typically question IDs (as strings), values are the answers.
	// Example: `{"101": "Partial answer...", "105": [2]}`
	DraftAnswersContent datatypes.JSON `json:"draft_answers_content,omitempty" gorm:"column:draft_answers_content;type:jsonb"`

	// LastSaved indicates when the draft was last automatically saved.
	LastSaved time.Time `json:"last_saved" gorm:"column:last_saved;not null"`

	// CreatedAt timestamp for when the draft record was first created.
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	// UpdatedAt timestamp for when the draft record was last updated.
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`

	// --- Relationships ---
	// SurveySession *SurveySession `json:"-" gorm:"foreignKey:SessionID"` // Optional GORM relationship
}

// TableName specifies the corresponding database table name for GORM.
func (ParticipantSurveyDraft) TableName() string {
	return "participant_survey_drafts" // Assumes table name from previous suggestion
}

// --------------------------------------------------------------------------

// SurveyMediaFile tracks media files uploaded by a participant during a specific
// survey session, often as a response to a question.
type SurveyMediaFile struct {
	// MediaID is the unique identifier for this media file record.
	MediaID uint `json:"id" gorm:"primaryKey;column:media_id"`

	// SessionID links this media file to the specific survey session.
	SessionID uint `json:"session_id" gorm:"column:session_id;not null;index"`

	// SurveyID might be redundant if SessionID is present, but included as per your SQL.
	// Refers to a survey defined elsewhere.
	SurveyID uint `json:"survey_id" gorm:"column:survey_id;index"`

	// QuestionID identifies the question this media file is associated with.
	// Refers to a question defined elsewhere.
	QuestionID uint `json:"question_id" gorm:"column:question_id;index"`

	// FileURL is the URL or path where the actual media file is stored (e.g., S3 URL).
	FileURL string `json:"file_url" gorm:"column:file_url;not null"`

	// FileType indicates the type of media (e.g., "IMAGE", "VIDEO", "AUDIO", "PDF").
	FileType string `json:"file_type" gorm:"column:file_type;not null"`

	// CreatedAt timestamp for when the media file record was created.
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	// UpdatedAt timestamp (less common for media files unless metadata is updated).
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`

	// --- Relationships ---
	// SurveySession *SurveySession `json:"-" gorm:"foreignKey:SessionID"` // Optional GORM relationship
}

// TableName specifies the corresponding database table name for GORM.
func (SurveyMediaFile) TableName() string {
	return "survey_media_files"
}

// --------------------------------------------------------------------------

// QuestionEvaluation stores the conductor's evaluation for a single question answer
// within a specific survey session. Used for manual evaluation of quizzes.
type QuestionEvaluation struct {
	// EvaluationID is the unique identifier for this evaluation record.
	EvaluationID uint `json:"id" gorm:"primaryKey;column:evaluation_id"`

	// SessionID links this evaluation to a specific survey session.
	SessionID uint `json:"session_id" gorm:"column:session_id;not null;index"`

	// QuestionID identifies the question being evaluated.
	QuestionID uint `json:"question_id" gorm:"column:question_id;not null;index"`

	// MarksGiven is the score awarded by the conductor for this question.
	MarksGiven float64 `json:"marks_given" gorm:"column:marks_given;not null"`

	// MaxMarks is the maximum possible score for this question.
	MaxMarks float64 `json:"max_marks" gorm:"column:max_marks;not null"`

	// Feedback is optional text feedback from the conductor explaining the grade.
	Feedback string `json:"feedback,omitempty" gorm:"column:feedback;type:text"`

	// EvaluatedBy stores the conductor ID who performed this evaluation.
	EvaluatedBy uint `json:"evaluated_by" gorm:"column:evaluated_by;not null"`

	// CreatedAt timestamp for when the evaluation was created.
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	// UpdatedAt timestamp for when the evaluation was last updated.
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`
}

// TableName specifies the corresponding database table name for GORM.
func (QuestionEvaluation) TableName() string {
	return "question_evaluations"
}
