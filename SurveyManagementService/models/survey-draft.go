package models

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONContent is a custom type to handle JSON content in the database
// It implements driver.Valuer and sql.Scanner interfaces for proper DB interaction
type JSONContent json.RawMessage

// Value implements the driver.Valuer interface
func (j JSONContent) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return string(j), nil // Convert to string to avoid bytea storage
}

// Scan implements the sql.Scanner interface
func (j *JSONContent) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("unsupported type: %T", value)
	}

	*j = JSONContent(data)
	return nil
}

// MarshalJSON implements the json.Marshaler interface
func (j JSONContent) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

// UnmarshalJSON implements the json.Unmarshaler interface
func (j *JSONContent) UnmarshalJSON(data []byte) error {
	if j == nil {
		return fmt.Errorf("JSONContent: UnmarshalJSON on nil pointer")
	}
	*j = data
	return nil
}

type SurveyDraft struct {
	DraftID            uint        `json:"id" gorm:"primaryKey"`
	SurveyID           uint        `json:"survey_id"`
	DraftContent       JSONContent `json:"draft_content" gorm:"type:jsonb"` // Use jsonb type after migration
	LastEditedQuestion uint        `json:"last_edited_question"`
	LastSaved          time.Time   `json:"last_saved"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

// String provides a custom string representation for SurveyDraft
// This helps prevent [binary data] in logs
func (s SurveyDraft) String() string {
	// Pretty print the draft content
	var prettyContent bytes.Buffer
	if len(s.DraftContent) > 0 {
		if err := json.Indent(&prettyContent, []byte(s.DraftContent), "", "  "); err == nil {
			return fmt.Sprintf("SurveyDraft{ID: %d, SurveyID: %d, Content: %s, LastEdited: %d, LastSaved: %s}",
				s.DraftID, s.SurveyID, prettyContent.String(), s.LastEditedQuestion, s.LastSaved)
		}
	}

	// Fallback if pretty printing fails
	return fmt.Sprintf("SurveyDraft{ID: %d, SurveyID: %d, LastEdited: %d, LastSaved: %s}",
		s.DraftID, s.SurveyID, s.LastEditedQuestion, s.LastSaved)
}
