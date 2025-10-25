
package models

import (
	"time"
	
)

type BranchingRule struct {
    RuleID           uint      `json:"id" gorm:"primaryKey"`
    SurveyID         uint      `json:"survey_id"`
    SourceQuestionID uint      `json:"source_question_id"`
    TargetQuestionID uint      `json:"target_question_id"`
    Condition        string    `json:"condition"`
    CreatedAt        time.Time `json:"created_at"`
    UpdatedAt        time.Time `json:"updated_at"`
}