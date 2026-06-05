package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type ColumnInfo struct {
	ColumnName    string
	DataType      string
	IsNullable    string
	ColumnDefault *string
}

func main() {
	// Load environment variables
	godotenv.Load()

	dbHost := getEnv("DB_HOST", "localhost")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres123")
	dbName := getEnv("DB_NAME", "SurveyDb")
	dbPort := getEnv("DB_PORT", "5432")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	// Get survey_access_controls schema
	log.Println("\n📋 survey_access_controls table structure:")
	log.Println("=" + fmt.Sprintf("%s", "========================================"))

	var accessControlColumns []ColumnInfo
	db.Raw(`
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = 'survey_access_controls'
		ORDER BY ordinal_position
	`).Scan(&accessControlColumns)

	for _, col := range accessControlColumns {
		defaultVal := "NULL"
		if col.ColumnDefault != nil {
			defaultVal = *col.ColumnDefault
		}
		log.Printf("  %-20s | %-20s | Nullable: %-3s | Default: %s",
			col.ColumnName, col.DataType, col.IsNullable, defaultVal)
	}

	// Get survey_access_logs schema
	log.Println("\n📋 survey_access_logs table structure:")
	log.Println("=" + fmt.Sprintf("%s", "========================================"))

	var accessLogColumns []ColumnInfo
	db.Raw(`
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = 'survey_access_logs'
		ORDER BY ordinal_position
	`).Scan(&accessLogColumns)

	for _, col := range accessLogColumns {
		defaultVal := "NULL"
		if col.ColumnDefault != nil {
			defaultVal = *col.ColumnDefault
		}
		log.Printf("  %-20s | %-20s | Nullable: %-3s | Default: %s",
			col.ColumnName, col.DataType, col.IsNullable, defaultVal)
	}

	// Check indexes on survey_access_controls
	log.Println("\n🔍 Indexes on survey_access_controls:")
	var indexes []struct {
		IndexName string
		ColumnName string
	}
	db.Raw(`
		SELECT i.relname as index_name, a.attname as column_name
		FROM pg_class t
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		WHERE t.relname = 'survey_access_controls'
		ORDER BY i.relname, a.attname
	`).Scan(&indexes)

	for _, idx := range indexes {
		log.Printf("  Index: %-40s on column: %s", idx.IndexName, idx.ColumnName)
	}

	// Check updated surveys table
	log.Println("\n📋 New columns in surveys table:")
	log.Println("=" + fmt.Sprintf("%s", "========================================"))

	var surveyColumns []ColumnInfo
	db.Raw(`
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = 'surveys'
		AND column_name IN ('is_shareable', 'share_enabled_at')
		ORDER BY ordinal_position
	`).Scan(&surveyColumns)

	for _, col := range surveyColumns {
		defaultVal := "NULL"
		if col.ColumnDefault != nil {
			defaultVal = *col.ColumnDefault
		}
		log.Printf("  %-20s | %-20s | Nullable: %-3s | Default: %s",
			col.ColumnName, col.DataType, col.IsNullable, defaultVal)
	}

	log.Println("\n✅ Schema verification complete!")
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
