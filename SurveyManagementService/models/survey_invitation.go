package models

import (
	"time"
)

// SurveyInvitation tracks email invitations sent for a survey
type SurveyInvitation struct {
	ID              uint       `json:"id" gorm:"primaryKey"`
	SurveyID        uint       `json:"survey_id" gorm:"not null;index"`
	Email           string     `json:"email" gorm:"type:varchar(255);not null"`
	InvitationToken string     `json:"invitation_token" gorm:"type:varchar(100);uniqueIndex"` // NEW: Unique token per invitation
	Status          string     `json:"status" gorm:"type:varchar(20);default:'PENDING'"` // PENDING, SENT, FAILED, CLICKED, COMPLETED
	SentAt          *time.Time `json:"sent_at,omitempty"`
	ClickedAt       *time.Time `json:"clicked_at,omitempty"` // NEW: Track when link was clicked
	CompletedAt     *time.Time `json:"completed_at,omitempty"` // NEW: Track when survey was completed
	ErrorMsg        string     `json:"error_msg,omitempty" gorm:"type:text"`
	CreatedAt       time.Time  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updated_at" gorm:"autoUpdateTime"`
}

func (SurveyInvitation) TableName() string {
	return "survey_invitations"
}

// InvitationStats provides summary statistics for a survey's invitations
type InvitationStats struct {
	TotalInvited   int `json:"total_invited"`
	TotalSent      int `json:"total_sent"`
	TotalFailed    int `json:"total_failed"`
	TotalPending   int `json:"total_pending"`
	TotalClicked   int `json:"total_clicked"`
	TotalCompleted int `json:"total_completed"`
}

