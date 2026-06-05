package models

import (
	"context"
	"time"

	"gorm.io/datatypes"
)

type Survey struct {
	SurveyID          uint                `json:"id" gorm:"primaryKey"`
	ConductorID       uint                `json:"conductor_id"`
	Title             string              `json:"title"`
	Description       string              `json:"description"`
	IsSelfRecruitment bool                `json:"is_self_recruitment"`
	Status            string              `json:"status"`
	IsShareable       bool                `json:"is_shareable" gorm:"default:false"`
	ShareEnabledAt    *time.Time          `json:"share_enabled_at,omitempty"`
	// Distribution settings
	AllowAnonymous    bool                `json:"allow_anonymous" gorm:"default:false"` // If true, participants don't need to register
	// Display mode: how questions are presented to participants ("one_by_one" or "all_at_once")
	QuestionDisplayMode string            `json:"question_display_mode" gorm:"default:'one_by_one'"`
	// Quiz-specific fields
	IsQuiz                    bool   `json:"is_quiz" gorm:"default:false"`
	TimeLimitMinutes          *int   `json:"time_limit_minutes,omitempty"`
	PassingScorePercentage    *int   `json:"passing_score_percentage,omitempty"`
	ShowCorrectAnswers        bool   `json:"show_correct_answers" gorm:"default:true"`
	ShuffleQuestions          bool   `json:"shuffle_questions" gorm:"default:false"`
	ShuffleOptions            bool   `json:"shuffle_options" gorm:"default:false"`
	MaxAttempts               *int   `json:"max_attempts,omitempty"` // Max times a participant can take this survey (null = unlimited)
	RequiresManualEvaluation  bool   `json:"requires_manual_evaluation" gorm:"default:false"` // If true, conductor must manually grade submissions
	// Custom participant fields - JSON array of field definitions
	// Example: [{"id":"name","label":"Full Name","type":"text","required":true},{"id":"roll_no","label":"Roll Number","type":"text","required":false}]
	ParticipantFields       datatypes.JSON `json:"participant_fields,omitempty" gorm:"type:jsonb"`
	Questions         []Question          `json:"questions,omitempty" gorm:"foreignKey:SurveyID"`
	Requirements      []SurveyRequirement `json:"requirements,omitempty" gorm:"foreignKey:SurveyID"`
	CreatedAt         time.Time           `json:"created_at"`
	UpdatedAt         time.Time           `json:"updated_at"`
}

type Question struct {
	QuestionID     uint              `json:"id" gorm:"primaryKey"`
	SurveyID       uint              `json:"survey_id"`
	QuestionText   string            `json:"question_text"`
	QuestionType   string            `json:"question_type"`
	Options        []Option          `json:"options,omitempty" gorm:"foreignKey:QuestionID"`
	MediaFiles     []SurveyMediaFile `json:"media_files,omitempty" gorm:"foreignKey:QuestionID;references:QuestionID;constraint:false"`
	CorrectAnswers string            `json:"correct_answers"`
	BranchingLogic string            `json:"branching_logic"`
	Mandatory      bool              `json:"mandatory"`
	Points         int               `json:"points" gorm:"default:1"`
	Explanation    string            `json:"explanation"`
	// Participant-authored justification ("reason") for choice questions (anti-cheating).
	RequiresJustification bool       `json:"requires_justification" gorm:"default:false"`
	JustificationRequired bool       `json:"justification_required" gorm:"default:false"`
	CreatedAt      time.Time         `json:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
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
