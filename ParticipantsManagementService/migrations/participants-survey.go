package migrations

import (
	"log"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/models"
	"gorm.io/gorm"
)

func MigrateSurveyTables(db *gorm.DB) error {
	// AutoMigrate models to create the tables
	err := db.AutoMigrate(
		&models.SurveySession{},
		&models.Answer{},
		&models.ParticipantSurveyDraft{},
		&models.SurveyMediaFile{},
	)
	if err != nil {
		log.Printf("Failed to migrate survey-related tables: %v", err)
		return err
	}
	log.Println("Survey-related tables migrated successfully.")
	return nil
}

// RunMigrations executes all migrations
func RunMigrations(db *gorm.DB) (bool, error) {
	err := MigrateSurveyTables(db)
	return err == nil, err
}
