package models

import (
	"time"
)

type Survey struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	ConductorID     uint      `json:"conductor_id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	IsEncrypted     bool      `json:"is_encrypted"`
	IsSelfRecruitment bool    `json:"is_self_recruitment"`
	Questions       []Question `json:"questions,omitempty" gorm:"foreignKey:SurveyID"`
	Requirements    []SurveyRequirement `json:"requirements,omitempty" gorm:"foreignKey:SurveyID"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Question struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	SurveyID       uint      `json:"survey_id"`
	QuestionText   string    `json:"question_text"`
	QuestionType   string    `json:"question_type"`
	BranchingLogic JSON      `json:"branching_logic"`
	Mandatory      bool      `json:"mandatory"`
	OrderIndex     int       `json:"order_index"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
