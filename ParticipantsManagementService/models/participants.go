package models

import (
	"encoding/json"
	"time"
)

// ExperienceLevel represents the experience level of a participant
type ExperienceLevel string

const (
	Beginner     ExperienceLevel = "BEGINNER"
	Intermediate ExperienceLevel = "INTERMEDIATE"
	Expert       ExperienceLevel = "EXPERT"
)

// RecurrenceType represents the type of recurrence for availability
type RecurrenceType string

const (
	Daily   RecurrenceType = "DAILY"
	Weekly  RecurrenceType = "WEEKLY"
	Monthly RecurrenceType = "MONTHLY"
	None    RecurrenceType = "NONE"
)


// ParticipantSkill represents a skill possessed by a participant
type ParticipantSkill struct {
	SkillID          int       `json:"skillId" gorm:"primaryKey;column:skill_id"`
	ParticipantID    int       `json:"participantId" gorm:"column:participant_id"`
	SkillName        string    `json:"skillName" gorm:"column:skill_name"`
	ProficiencyLevel int       `json:"proficiencyLevel" gorm:"column:proficiency_level"`
	UpdatedAt        time.Time `json:"updatedAt" gorm:"column:updated_at"`
}

// RecurrenceRule represents the rules for recurring availability
type RecurrenceRule struct {
	Frequency  string   `json:"frequency"`
	Interval   int      `json:"interval"`
	WeekDays   []string `json:"weekDays,omitempty"`
	MonthDays  []int    `json:"monthDays,omitempty"`
	EndDate    string   `json:"endDate,omitempty"`
	Exceptions []string `json:"exceptions,omitempty"`
}

// ParticipantAvailability represents the availability schedule of a participant
type ParticipantAvailability struct {
	AvailabilityID  int            `json:"availabilityId" gorm:"primaryKey;column:availability_id"`
	ParticipantID   int            `json:"participantId" gorm:"column:participant_id"`
	StartTime       time.Time      `json:"startTime" gorm:"column:start_time"`
	EndTime         time.Time      `json:"endTime" gorm:"column:end_time"`
	RecurrenceType  RecurrenceType `json:"recurrenceType" gorm:"column:recurrence_type"`
	RecurrenceRule  json.RawMessage `json:"recurrenceRule" gorm:"column:recurrence_rule;type:json"`
}

// TableName specifies the table name for Participant
func (Participant) TableName() string {
	return "participants"
}

// TableName specifies the table name for ParticipantSkill
func (ParticipantSkill) TableName() string {
	return "participant_skills"
}

// TableName specifies the table name for ParticipantAvailability
func (ParticipantAvailability) TableName() string {
	return "participant_availability"
}