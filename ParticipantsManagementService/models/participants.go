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
	// to a participant defined in the AuthService.
	ParticipantID uint `json:"participant_id" gorm:"column:participant_id;not null;index"` // Index useful for lookups

	// LastQuestionID tracks the ID of the last question the participant was shown or answered.
	// Useful for resuming. Pointer allows null. Refers to a question defined elsewhere.
	LastQuestionID *uint `json:"last_question_id,omitempty" gorm:"column:last_question_id"`

	// SessionStatus indicates the current state of the survey attempt.
	// Examples: "IN_PROGRESS", "COMPLETED", "ABANDONED"
	SessionStatus string `json:"session_status" gorm:"column:session_status;not null;index"`

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
