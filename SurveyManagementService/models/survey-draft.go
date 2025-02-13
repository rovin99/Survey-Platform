
package models

import (
	"time"
	"encoding/json"
)
type SurveyDraft struct {
    DraftID            uint           `json:"id" gorm:"primaryKey"`
    SurveyID           uint           `json:"survey_id"`
    DraftContent       json.RawMessage `json:"draft_content"`
    LastEditedQuestion uint           `json:"last_edited_question"`
    LastSaved          time.Time      `json:"last_saved"`
    CreatedAt          time.Time      `json:"created_at"`
    UpdatedAt          time.Time      `json:"updated_at"`
}