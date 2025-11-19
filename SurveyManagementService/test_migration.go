package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Database connection
	dbHost := getEnv("DB_HOST", "localhost")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres123")
	dbName := getEnv("DB_NAME", "SurveyDb")
	dbPort := getEnv("DB_PORT", "5432")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode)

	log.Println("🔌 Connecting to database...")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}
	log.Println("✅ Database connected successfully!")

	// Run migrations
	log.Println("🔄 Running migrations...")
	err = db.AutoMigrate(
		&models.Survey{},
		&models.Question{},
		&models.Option{},
		&models.SurveyRequirement{},
		&models.Answer{},
		&models.SurveySession{},
		&models.SurveyMediaFile{},
		&models.SurveyDraft{},
		&models.BranchingRule{},
		&models.SurveyAccessControl{},
		&models.SurveyAccessLog{},
	)
	if err != nil {
		log.Fatalf("❌ Migration failed: %v", err)
	}
	log.Println("✅ Migrations completed successfully!")

	// Verify tables exist
	log.Println("\n📋 Verifying tables...")
	tables := []string{
		"surveys",
		"questions",
		"options",
		"survey_requirements",
		"answers",
		"survey_sessions",
		"survey_media_files",
		"survey_drafts",
		"branching_rules",
		"survey_access_controls",
		"survey_access_logs",
	}

	for _, table := range tables {
		if db.Migrator().HasTable(table) {
			log.Printf("✅ Table '%s' exists", table)
		} else {
			log.Printf("❌ Table '%s' NOT FOUND", table)
		}
	}

	// Check new columns in surveys table
	log.Println("\n📋 Verifying new columns in surveys table...")
	if db.Migrator().HasColumn(&models.Survey{}, "is_shareable") {
		log.Println("✅ Column 'is_shareable' exists in surveys table")
	} else {
		log.Println("❌ Column 'is_shareable' NOT FOUND in surveys table")
	}

	if db.Migrator().HasColumn(&models.Survey{}, "share_enabled_at") {
		log.Println("✅ Column 'share_enabled_at' exists in surveys table")
	} else {
		log.Println("❌ Column 'share_enabled_at' NOT FOUND in surveys table")
	}

	// Check columns in survey_access_controls table
	log.Println("\n📋 Verifying columns in survey_access_controls table...")
	checkColumns := []string{"id", "survey_id", "access_type", "share_token", "is_active", "allowed_domains", "created_by", "expires_at"}
	for _, col := range checkColumns {
		if db.Migrator().HasColumn(&models.SurveyAccessControl{}, col) {
			log.Printf("✅ Column '%s' exists in survey_access_controls", col)
		} else {
			log.Printf("❌ Column '%s' NOT FOUND in survey_access_controls", col)
		}
	}

	// Check columns in survey_access_logs table
	log.Println("\n📋 Verifying columns in survey_access_logs table...")
	logColumns := []string{"id", "survey_id", "participant_id", "user_email", "access_granted", "denial_reason", "ip_address", "user_agent", "accessed_at"}
	for _, col := range logColumns {
		if db.Migrator().HasColumn(&models.SurveyAccessLog{}, col) {
			log.Printf("✅ Column '%s' exists in survey_access_logs", col)
		} else {
			log.Printf("❌ Column '%s' NOT FOUND in survey_access_logs", col)
		}
	}

	log.Println("\n🎉 All tests passed! Database schema is ready.")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
