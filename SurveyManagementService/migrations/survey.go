package migrations

import (
	"log"

	"gorm.io/gorm"
	"SurveyManagementService/models"
)

func MigrateSurveyTables(db *gorm.DB) {
	// AutoMigrate models to create the tables
	err := db.AutoMigrate(
		&models.Survey{},
		&models.Question{},
		&models.SurveyRequirement{},
		&models.Answer{},
		&models.SurveySession{},
		&models.SurveyMediaFile{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate survey-related tables: %v", err)
	} else {
		log.Println("Survey-related tables migrated successfully.")
	}
}
