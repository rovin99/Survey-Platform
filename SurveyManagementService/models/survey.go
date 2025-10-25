package models

import (
	"context"
	"time"
)

type Survey struct {
	SurveyID          uint                `json:"id" gorm:"primaryKey"`
	ConductorID       uint                `json:"conductor_id"`
	Title             string              `json:"title"`
	Description       string              `json:"description"`
	IsSelfRecruitment bool                `json:"is_self_recruitment"`
	Status            string              `json:"status"`
	Questions         []Question          `json:"questions,omitempty" gorm:"foreignKey:SurveyID"`
	Requirements      []SurveyRequirement `json:"requirements,omitempty" gorm:"foreignKey:SurveyID"`
	CreatedAt         time.Time           `json:"created_at"`
	UpdatedAt         time.Time           `json:"updated_at"`
}

type Question struct {
	QuestionID     uint      `json:"id" gorm:"primaryKey"`
	SurveyID       uint      `json:"survey_id"`
	QuestionText   string    `json:"question_text"`
	QuestionType   string    `json:"question_type"`   // Enum: Text, MultipleChoice, etc.
	Options        []Option  `json:"options,omitempty" gorm:"foreignKey:QuestionID"` // For multiple-choice questions
	CorrectAnswers string    `json:"correct_answers"` // Comma-separated IDs or JSON string for multiple correct answers
	BranchingLogic string    `json:"branching_logic"` // JSON string or nullable field
	Mandatory      bool      `json:"mandatory"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}


type Option struct {
	OptionID    uint      `json:"id" gorm:"primaryKey"`
	QuestionID  uint      `json:"question_id"`
	OptionText  string    `json:"option_text"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SurveyRequirement struct {
	RequirementID       uint      `json:"id" gorm:"primaryKey"`
	SurveyID            uint      `json:"survey_id"`
	SkillName           string    `json:"skill_name"`
	MinProficiencyLevel int       `json:"min_proficiency_level"`
	ExperienceLevel     string    `json:"experience_level"` // Enum: Beginner, Intermediate, Advanced
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type Answer struct {
    AnswerID    uint      `json:"id" gorm:"primaryKey"`
    SessionID   uint      `json:"session_id"`
    QuestionID  uint      `json:"question_id"`
    ResponseData string   `json:"response_data"` // JSON string with appropriate structure for each question type
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type SurveySession struct {
	SessionID      uint      `json:"id" gorm:"primaryKey"`
	SurveyID       uint      `json:"survey_id"`
	ParticipantID  uint      `json:"participant_id"`
	LastQuestionID uint      `json:"last_question_id"` // Nullable, tracks progress
	SessionStatus  string    `json:"session_status"`   // Enum: NOT_STARTED, IN_PROGRESS, COMPLETED, ABANDONED
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type SurveyMediaFile struct {
	MediaID    uint      `json:"id" gorm:"primaryKey"`
	SessionID  uint      `json:"session_id"`
	SurveyID   uint      `json:"survey_id"`
	QuestionID uint      `json:"question_id"`
	FileURL    string    `json:"file_url"`
	FileType   string    `json:"file_type"` // Enum: IMAGE, VIDEO, AUDIO, DOCUMENT
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// MediaRepository defines the interface for media storage operations
type MediaRepository interface {
	Create(ctx context.Context, media *SurveyMediaFile) error
	GetBySessionID(ctx context.Context, sessionID uint) ([]SurveyMediaFile, error)
	GetByQuestionID(ctx context.Context, questionID uint) ([]SurveyMediaFile, error)
}
