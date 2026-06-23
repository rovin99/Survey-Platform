package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// generateSessionToken creates a cryptographically secure 64-character hex token
func generateSessionToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

var ErrSessionNotFound = errors.New("session not found")
var ErrDraftNotFound = errors.New("draft not found")

// BrowserInfo holds parsed user agent information for session tracking
type BrowserInfo struct {
	UserAgent      string
	BrowserName    string
	BrowserVersion string
	OSName         string
	DeviceType     string
	IPAddress      string
}

type ParticipantRepository interface {
	// Finds an IN_PROGRESS session or creates a new one. Returns the session.
	FindOrCreateSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error)
	// Finds an IN_PROGRESS session or creates a new one with email. Returns the session.
	FindOrCreateSessionWithEmail(ctx context.Context, surveyID, participantID uint, email string) (*models.SurveySession, error)
	// Finds an IN_PROGRESS session or creates a new one with email and participant info. Returns the session.
	FindOrCreateSessionWithParticipantInfo(ctx context.Context, surveyID, participantID uint, email string, participantInfo datatypes.JSON) (*models.SurveySession, error)
	// Gets session details.
	GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error)
	// Gets session by its secure token (for anonymous session validation)
	GetSessionByToken(ctx context.Context, token string) (*models.SurveySession, error)
	GetSessionBySurveyParticipant(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) // Useful if sessionID isn't known upfront
	// Updates session status and potentially the last question ID.
	UpdateSession(ctx context.Context, session *models.SurveySession) error
	// Retrieves the draft associated with a session. Creates an empty one if not found.
	FindOrCreateDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	// Updates the draft content and last saved timestamp.
	UpdateDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent datatypes.JSON) error
	// Retrieves draft content only.
	GetDraftBySessionID(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error)
	// Deletes the draft for a session (used after submission).
	DeleteDraft(ctx context.Context, sessionID uint) error
	// Saves the final answers batch.
	CreateAnswersBatch(ctx context.Context, answers []models.Answer) error
	// GetDB returns the underlying gorm.DB instance
	GetDB() *gorm.DB
	// Gets all sessions for a survey (for analytics)
	GetSessionsBySurveyID(ctx context.Context, surveyID uint) ([]models.SurveySession, error)
	// Gets all completed sessions for a survey
	GetCompletedSessionsBySurveyID(ctx context.Context, surveyID uint) ([]models.SurveySession, error)
	// Gets all answers for a session
	GetAnswersBySessionID(ctx context.Context, sessionID uint) ([]models.Answer, error)
	// Gets all answers for a survey (across all sessions)
	GetAnswersBySurveyID(ctx context.Context, surveyID uint) ([]models.Answer, error)
	// Verifies that the conductor owns the survey (for access control)
	VerifySurveyOwnership(ctx context.Context, surveyID, conductorID uint) (bool, error)
	// CreateAnonymousSession creates a new session for anonymous users with unique token
	CreateAnonymousSession(ctx context.Context, surveyID uint, email string, participantInfo datatypes.JSON) (*models.SurveySession, error)
	// FindAnonymousSessionByEmail finds an existing anonymous session by survey and email
	FindAnonymousSessionByEmail(ctx context.Context, surveyID uint, email string) (*models.SurveySession, error)
	// CountCompletedAttempts counts completed sessions for a participant on a survey
	CountCompletedAttempts(ctx context.Context, surveyID, participantID uint) (int, error)
	// CountCompletedAttemptsByEmail counts completed sessions for an email on a survey (for anonymous users)
	CountCompletedAttemptsByEmail(ctx context.Context, surveyID uint, email string) (int, error)
	// CreateRetakeSession creates a new session for a retake (even if previous sessions exist)
	CreateRetakeSession(ctx context.Context, surveyID, participantID uint, email string, participantInfo datatypes.JSON, attemptNumber int) (*models.SurveySession, error)
	// UpdateSessionBrowserInfo updates the browser/device info for a session
	UpdateSessionBrowserInfo(ctx context.Context, sessionID uint, info BrowserInfo) error
	// UpdateTabSwitchCount updates the tab switch count (only if new count > existing)
	UpdateTabSwitchCount(ctx context.Context, sessionID uint, count int) error

	// MarkSessionStarted records the quiz start time once (idempotent)
	MarkSessionStarted(ctx context.Context, sessionID uint) error
	// DeleteSession deletes a session and its associated data (for conductor reset)
	DeleteSession(ctx context.Context, sessionID uint) error
	// DeleteSessionsByEmail deletes all sessions for an email on a survey (for full reset)
	DeleteSessionsByEmail(ctx context.Context, surveyID uint, email string) error
	// GetSessionsByParticipantID gets all sessions for a participant (for history)
	GetSessionsByParticipantID(ctx context.Context, participantID uint) ([]models.SurveySession, error)
	// GetSessionsByParticipantIDOrEmail gets sessions by participant ID OR by email (for anonymous sessions)
	// This allows linking anonymous sessions to users who later register with the same email
	GetSessionsByParticipantIDOrEmail(ctx context.Context, participantID uint, email string, emailHash string) ([]models.SurveySession, error)
	// EnsureSessionToken generates and saves a session token if one doesn't exist
	EnsureSessionToken(ctx context.Context, sessionID uint) error
}

type gormParticipantRepository struct {
	db *gorm.DB
}

// GetDB returns the underlying gorm.DB instance
func (r *gormParticipantRepository) GetDB() *gorm.DB {
	return r.db
}

func NewGormParticipantRepository(db *gorm.DB) ParticipantRepository {
	// Auto-migrate if needed (consider running migrations separately)
	// db.AutoMigrate(&models.SurveySession{}, &models.ParticipantSurveyDraft{}, &models.Answer{})
	return &gormParticipantRepository{db: db}
}

func (r *gormParticipantRepository) FindOrCreateSession(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) {
	var session models.SurveySession

	// Try to find an existing active session
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS").
		First(&session).Error

	if err == nil {
		// Found existing session
		return &session, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Other database error
		return nil, err
	}

	// Not found, create a new one with session token
	newSession := models.SurveySession{
		SurveyID:      surveyID,
		ParticipantID: participantID,
		SessionStatus: "IN_PROGRESS",
		SessionToken:  generateSessionToken(),
	}

	err = r.db.WithContext(ctx).Create(&newSession).Error
	if err != nil {
		return nil, err
	}
	return &newSession, nil
}

func (r *gormParticipantRepository) FindOrCreateSessionWithEmail(ctx context.Context, surveyID, participantID uint, email string) (*models.SurveySession, error) {
	var session models.SurveySession

	// Try to find an existing active session
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS").
		First(&session).Error

	if err == nil {
		// Found existing session - update email if provided and not already set
		if email != "" && session.ParticipantEmail == "" {
			session.ParticipantEmail = email
			r.db.WithContext(ctx).Save(&session)
		}
		return &session, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Other database error
		return nil, err
	}

	// Not found, create a new one with email and session token
	newSession := models.SurveySession{
		SurveyID:         surveyID,
		ParticipantID:    participantID,
		SessionStatus:    "IN_PROGRESS",
		ParticipantEmail: email,
		SessionToken:     generateSessionToken(),
	}

	err = r.db.WithContext(ctx).Create(&newSession).Error
	if err != nil {
		return nil, err
	}
	return &newSession, nil
}

func (r *gormParticipantRepository) FindOrCreateSessionWithParticipantInfo(ctx context.Context, surveyID, participantID uint, email string, participantInfo datatypes.JSON) (*models.SurveySession, error) {
	var session models.SurveySession

	// Try to find an existing active session
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS").
		First(&session).Error

	if err == nil {
		// Found existing session - update email and participant_info if provided and not already set
		needsUpdate := false
		if email != "" && session.ParticipantEmail == "" {
			session.ParticipantEmail = email
			needsUpdate = true
		}
		if len(participantInfo) > 0 && len(session.ParticipantInfo) == 0 {
			session.ParticipantInfo = participantInfo
			needsUpdate = true
		}
		if needsUpdate {
			r.db.WithContext(ctx).Save(&session)
		}
		return &session, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		// Other database error
		return nil, err
	}

	// Not found, create a new one with email, participant info, and session token
	newSession := models.SurveySession{
		SurveyID:         surveyID,
		ParticipantID:    participantID,
		SessionStatus:    "IN_PROGRESS",
		ParticipantEmail: email,
		ParticipantInfo:  participantInfo,
		SessionToken:     generateSessionToken(),
	}

	err = r.db.WithContext(ctx).Create(&newSession).Error
	if err != nil {
		return nil, err
	}
	return &newSession, nil
}

func (r *gormParticipantRepository) GetSessionByID(ctx context.Context, sessionID uint) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).First(&session, sessionID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	return &session, err
}

func (r *gormParticipantRepository) GetSessionByToken(ctx context.Context, token string) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).
		Where("session_token = ?", token).
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	return &session, err
}

func (r *gormParticipantRepository) GetSessionBySurveyParticipant(ctx context.Context, surveyID, participantID uint) (*models.SurveySession, error) {
	var session models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "IN_PROGRESS"). // Maybe filter by status?
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrSessionNotFound
	}
	return &session, err
}

func (r *gormParticipantRepository) UpdateSession(ctx context.Context, session *models.SurveySession) error {
	return r.db.WithContext(ctx).Save(session).Error // Save updates all fields
}

func (r *gormParticipantRepository) FindOrCreateDraft(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error) {
	var draft models.ParticipantSurveyDraft

	// Use FirstOrCreate: Finds first record matching attributes, or create a new one if not found.
	// Important: Provide default values for creation.
	err := r.db.WithContext(ctx).
		Where(models.ParticipantSurveyDraft{SessionID: sessionID}).
		Assign(models.ParticipantSurveyDraft{LastSaved: time.Now()}). // Assign values only on create/update
		FirstOrCreate(&draft).Error

	return &draft, err
}

func (r *gormParticipantRepository) UpdateDraft(ctx context.Context, sessionID uint, lastQuestionID *uint, draftContent datatypes.JSON) error {
	// Upsert logic: Insert if not exists, update if exists based on session_id (unique index)
	draft := models.ParticipantSurveyDraft{
		SessionID:              sessionID,
		LastAnsweredQuestionID: lastQuestionID,
		DraftAnswersContent:    draftContent,
		LastSaved:              time.Now(),
	}

	// Use Clauses(clause.OnConflict...) for upsert based on the unique constraint on session_id
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "session_id"}},                                                                                // conflict target
		DoUpdates: clause.AssignmentColumns([]string{"last_answered_question_id", "draft_answers_content", "last_saved", "updated_at"}), // columns to update
	}).Create(&draft).Error
}

func (r *gormParticipantRepository) GetDraftBySessionID(ctx context.Context, sessionID uint) (*models.ParticipantSurveyDraft, error) {
	var draft models.ParticipantSurveyDraft
	err := r.db.WithContext(ctx).Where("session_id = ?", sessionID).First(&draft).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// It's okay if a draft doesn't exist yet, return nil draft without error
		return nil, nil
	}
	return &draft, err
}

func (r *gormParticipantRepository) DeleteDraft(ctx context.Context, sessionID uint) error {
	result := r.db.WithContext(ctx).Where("session_id = ?", sessionID).Delete(&models.ParticipantSurveyDraft{})
	if result.Error != nil {
		return result.Error
	}
	// GORM returns RowsAffected=0 if no record found, which isn't necessarily an error here.
	// if result.RowsAffected == 0 {
	// 	 return ErrDraftNotFound // Decide if this is an error condition
	// }
	return nil
}

func (r *gormParticipantRepository) CreateAnswersBatch(ctx context.Context, answers []models.Answer) error {
	if len(answers) == 0 {
		return nil // Nothing to insert
	}
	return r.db.WithContext(ctx).Create(&answers).Error
}

// GetSessionsBySurveyID retrieves all sessions for a specific survey
func (r *gormParticipantRepository) GetSessionsBySurveyID(ctx context.Context, surveyID uint) ([]models.SurveySession, error) {
	var sessions []models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ?", surveyID).
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// GetCompletedSessionsBySurveyID retrieves all completed sessions for a specific survey
func (r *gormParticipantRepository) GetCompletedSessionsBySurveyID(ctx context.Context, surveyID uint) ([]models.SurveySession, error) {
	var sessions []models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND session_status = ?", surveyID, "COMPLETED").
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// GetAnswersBySessionID retrieves all answers for a specific session
func (r *gormParticipantRepository) GetAnswersBySessionID(ctx context.Context, sessionID uint) ([]models.Answer, error) {
	var answers []models.Answer
	err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("question_id ASC").
		Find(&answers).Error
	return answers, err
}

// GetAnswersBySurveyID retrieves all answers for a survey across all completed sessions
func (r *gormParticipantRepository) GetAnswersBySurveyID(ctx context.Context, surveyID uint) ([]models.Answer, error) {
	var answers []models.Answer
	err := r.db.WithContext(ctx).
		Joins("JOIN survey_sessions ON answers.session_id = survey_sessions.session_id").
		Where("survey_sessions.survey_id = ? AND survey_sessions.session_status = ?", surveyID, "COMPLETED").
		Order("answers.created_at DESC").
		Find(&answers).Error
	return answers, err
}

// VerifySurveyOwnership checks if the conductor owns the survey
// Queries the surveys table directly (shared database)
func (r *gormParticipantRepository) VerifySurveyOwnership(ctx context.Context, surveyID, conductorID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("surveys").
		Where("survey_id = ? AND conductor_id = ?", surveyID, conductorID).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateAnonymousSession creates a new session for anonymous users.
// Always creates a new session with a unique session_token (no collision possible).
func (r *gormParticipantRepository) CreateAnonymousSession(ctx context.Context, surveyID uint, email string, participantInfo datatypes.JSON) (*models.SurveySession, error) {
	session := models.SurveySession{
		SurveyID:         surveyID,
		ParticipantID:    0, // 0 indicates anonymous user
		SessionStatus:    "IN_PROGRESS",
		ParticipantEmail: email,
		ParticipantInfo:  participantInfo,
		SessionToken:     generateSessionToken(),
	}

	if err := r.db.WithContext(ctx).Create(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// FindAnonymousSessionByEmail finds an existing IN_PROGRESS anonymous session by survey and email.
// Returns nil (not error) if no session found, allowing caller to create new session.
func (r *gormParticipantRepository) FindAnonymousSessionByEmail(ctx context.Context, surveyID uint, email string) (*models.SurveySession, error) {
	if email == "" {
		return nil, nil // No email means can't lookup - caller should create new session
	}

	var session models.SurveySession
	err := r.db.WithContext(ctx).
		Where("survey_id = ? AND participant_email = ? AND participant_id = 0 AND session_status = ?",
			surveyID, email, "IN_PROGRESS").
		First(&session).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil // Not found - not an error, caller can create new session
	}
	if err != nil {
		return nil, err // Actual database error
	}
	return &session, nil
}

// CountCompletedAttempts counts completed sessions for a participant on a survey
func (r *gormParticipantRepository) CountCompletedAttempts(ctx context.Context, surveyID, participantID uint) (int, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.SurveySession{}).
		Where("survey_id = ? AND participant_id = ? AND session_status = ?", surveyID, participantID, "COMPLETED").
		Count(&count).Error
	return int(count), err
}

// CountCompletedAttemptsByEmail counts completed sessions for an email on a survey (for anonymous users)
func (r *gormParticipantRepository) CountCompletedAttemptsByEmail(ctx context.Context, surveyID uint, email string) (int, error) {
	if email == "" {
		return 0, nil
	}
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.SurveySession{}).
		Where("survey_id = ? AND participant_email = ? AND session_status = ?", surveyID, email, "COMPLETED").
		Count(&count).Error
	return int(count), err
}

// CreateRetakeSession creates a new session for a retake with the specified attempt number
func (r *gormParticipantRepository) CreateRetakeSession(ctx context.Context, surveyID, participantID uint, email string, participantInfo datatypes.JSON, attemptNumber int) (*models.SurveySession, error) {
	session := models.SurveySession{
		SurveyID:         surveyID,
		ParticipantID:    participantID,
		SessionStatus:    "IN_PROGRESS",
		ParticipantEmail: email,
		ParticipantInfo:  participantInfo,
		SessionToken:     generateSessionToken(),
		AttemptNumber:    attemptNumber,
	}

	if err := r.db.WithContext(ctx).Create(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// UpdateSessionBrowserInfo updates the browser/device tracking info for a session
func (r *gormParticipantRepository) UpdateSessionBrowserInfo(ctx context.Context, sessionID uint, info BrowserInfo) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).
		Where("session_id = ?", sessionID).
		Updates(map[string]interface{}{
			"user_agent":      info.UserAgent,
			"browser_name":    info.BrowserName,
			"browser_version": info.BrowserVersion,
			"os_name":         info.OSName,
			"device_type":     info.DeviceType,
			"ip_address":      info.IPAddress,
		}).Error
}

// UpdateTabSwitchCount updates the tab switch count, only if the new count is greater than existing
func (r *gormParticipantRepository) UpdateTabSwitchCount(ctx context.Context, sessionID uint, count int) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).
		Where("session_id = ? AND tab_switch_count < ?", sessionID, count).
		Update("tab_switch_count", count).Error
}

// MarkSessionStarted records the quiz start time, but only the first time (idempotent) so that
// resuming or a double "Start" never resets the timer.
func (r *gormParticipantRepository) MarkSessionStarted(ctx context.Context, sessionID uint) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).
		Where("session_id = ? AND quiz_started_at IS NULL", sessionID).
		Update("quiz_started_at", time.Now()).Error
}

// DeleteSession deletes a session and all its associated data (answers, drafts)
func (r *gormParticipantRepository) DeleteSession(ctx context.Context, sessionID uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Delete answers for this session
		if err := tx.Where("session_id = ?", sessionID).Delete(&models.Answer{}).Error; err != nil {
			return err
		}
		// Delete draft for this session
		if err := tx.Where("session_id = ?", sessionID).Delete(&models.ParticipantSurveyDraft{}).Error; err != nil {
			return err
		}
		// Delete the session itself
		if err := tx.Where("session_id = ?", sessionID).Delete(&models.SurveySession{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// DeleteSessionsByEmail deletes all sessions for an email on a specific survey
func (r *gormParticipantRepository) DeleteSessionsByEmail(ctx context.Context, surveyID uint, email string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Get all session IDs for this email and survey
		var sessionIDs []uint
		if err := tx.Model(&models.SurveySession{}).
			Where("survey_id = ? AND participant_email = ?", surveyID, email).
			Pluck("session_id", &sessionIDs).Error; err != nil {
			return err
		}

		if len(sessionIDs) == 0 {
			return nil // Nothing to delete
		}

		// Delete answers for all sessions
		if err := tx.Where("session_id IN ?", sessionIDs).Delete(&models.Answer{}).Error; err != nil {
			return err
		}
		// Delete drafts for all sessions
		if err := tx.Where("session_id IN ?", sessionIDs).Delete(&models.ParticipantSurveyDraft{}).Error; err != nil {
			return err
		}
		// Delete all sessions
		if err := tx.Where("session_id IN ?", sessionIDs).Delete(&models.SurveySession{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// GetSessionsByParticipantID gets all sessions for a participant (for survey history)
func (r *gormParticipantRepository) GetSessionsByParticipantID(ctx context.Context, participantID uint) ([]models.SurveySession, error) {
	var sessions []models.SurveySession
	err := r.db.WithContext(ctx).
		Where("participant_id = ?", participantID).
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// EnsureSessionToken generates and saves a session token if one doesn't exist
// This is used to migrate old sessions that were created before token support
func (r *gormParticipantRepository) EnsureSessionToken(ctx context.Context, sessionID uint) error {
	return r.db.WithContext(ctx).Model(&models.SurveySession{}).
		Where("session_id = ? AND (session_token IS NULL OR session_token = '')", sessionID).
		Update("session_token", generateSessionToken()).Error
}

// GetSessionsByParticipantIDOrEmail gets sessions by participant ID OR by email (for anonymous sessions).
// This allows users who took surveys anonymously via invitation link to see those surveys
// in their dashboard after registering with the same email.
func (r *gormParticipantRepository) GetSessionsByParticipantIDOrEmail(ctx context.Context, participantID uint, email string, emailHash string) ([]models.SurveySession, error) {
	var sessions []models.SurveySession

	query := r.db.WithContext(ctx).Model(&models.SurveySession{})

	if email != "" {
		// Match: sessions owned by this participant id; OR any session taken with this raw email
		// (invitation / authenticated share-link sessions, case-insensitive); OR anonymous PUBLIC
		// share-link sessions which store the hashed email (sha256:...). This surfaces every survey
		// the user took with this email regardless of how they accessed it. Truly anonymous sessions
		// (empty participant_email) never match a non-empty email/hash.
		query = query.Where(
			"participant_id = ? OR LOWER(participant_email) = LOWER(?) OR participant_email = ?",
			participantID, email, emailHash,
		)
	} else {
		// No email provided, just get sessions by participant ID
		query = query.Where("participant_id = ?", participantID)
	}

	err := query.Order("created_at DESC").Find(&sessions).Error
	return sessions, err
}
