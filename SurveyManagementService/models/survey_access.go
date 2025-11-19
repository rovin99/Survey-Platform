package models

import (
	"time"
)

// SurveyAccessControl manages shareable survey links
type SurveyAccessControl struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	SurveyID       uint      `json:"survey_id" gorm:"not null;uniqueIndex"`
	AccessType     string    `json:"access_type" gorm:"type:varchar(50);not null"` // PUBLIC or ORGANIZATION
	ShareToken     string    `json:"share_token" gorm:"type:varchar(100);uniqueIndex;not null"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`
	AllowedDomains string    `json:"allowed_domains" gorm:"type:text"` // Comma-separated domains for ORGANIZATION type
	CreatedBy      uint      `json:"created_by" gorm:"not null"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

// SurveyAccessLog tracks all access attempts to shared surveys
type SurveyAccessLog struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	SurveyID      uint      `json:"survey_id" gorm:"not null;index"`
	ParticipantID *uint     `json:"participant_id,omitempty"`
	UserEmail     string    `json:"user_email" gorm:"type:varchar(255);not null"`
	AccessGranted bool      `json:"access_granted" gorm:"not null"`
	DenialReason  string    `json:"denial_reason,omitempty" gorm:"type:varchar(255)"`
	IPAddress     string    `json:"ip_address,omitempty" gorm:"type:varchar(50)"`
	UserAgent     string    `json:"user_agent,omitempty" gorm:"type:text"`
	AccessedAt    time.Time `json:"accessed_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (SurveyAccessControl) TableName() string {
	return "survey_access_controls"
}

func (SurveyAccessLog) TableName() string {
	return "survey_access_logs"
}
