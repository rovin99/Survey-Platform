package migrations

import (
	"log"

	"gorm.io/gorm"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

func MigrateConductorTable(db *gorm.DB) {
	// Automigrate the Conductor model
	err := db.AutoMigrate(&models.Conductor{})
	if err != nil {
		log.Fatalf("Failed to migrate Conductor table: %v", err)
	} else {
		log.Println("Conductor table migrated successfully.")
	}
}
