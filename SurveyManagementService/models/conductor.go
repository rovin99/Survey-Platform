package models

import (
	"time"
)

type ConductorType string

const (
	ConductorTypeInstitute ConductorType = "INSTITUTE"
	ConductorTypeCompany   ConductorType = "COMPANY"
)

type Conductor struct {
	ConductorID   uint         `json:"id" gorm:"primaryKey"`
	UserID        uint         `json:"user_id" gorm:"unique"`
	Name          string       `json:"name"`
	Type          ConductorType `json:"type" gorm:"type:varchar(20)"`
	Description   string       `json:"description"`
	ContactEmail  string       `json:"contact_email"`
	ContactPhone  string       `json:"contact_phone"`
	Address       string       `json:"address"`
	OfficialEmail string       `json:"official_email" gorm:"unique"` // Institute/Company email for verification
	IsVerified    bool         `json:"is_verified" gorm:"default:false"`
	VerificationCode string    `json:"verification_code,omitempty" gorm:"-"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}



type ConductorRegistrationRequest struct {
	Name          string        `json:"name"`
	Type          ConductorType `json:"type"` // Enum: INDIVIDUAL, INSTITUTE, COMPANY
	Description   string        `json:"description"`
	ContactEmail  string        `json:"contact_email"`
	ContactPhone  string        `json:"contact_phone"`
	Address       string        `json:"address"`
	OfficialEmail string        `json:"official_email"`
}

type ConductorUpdateRequest struct {
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	ContactEmail  string        `json:"contact_email"`
	ContactPhone  string        `json:"contact_phone"`
	Address       string        `json:"address"`
}
