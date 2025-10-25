package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/handler"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/migrations"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/routes"
	service "github.com/rovin99/Survey-Platform/ParticipantsManagementService/services"
)

func setupDatabase() (*gorm.DB, error) {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
		log.Println("Using environment variables or defaults...")
	}

	// Get environment variables with defaults for development
	dbHost := getEnvOrDefault("DB_HOST", "localhost")
	dbUser := getEnvOrDefault("DB_USER", "postgres")
	dbPassword := getEnvOrDefault("DB_PASSWORD", "postgres123")
	dbName := getEnvOrDefault("DB_NAME", "SurveyDb")
	dbPort := getEnvOrDefault("DB_PORT", "5432")
	dbSSLMode := getEnvOrDefault("DB_SSLMODE", "disable")

	// Validate required database parameters
	if dbHost == "" || dbUser == "" || dbName == "" || dbPort == "" {
		return nil, fmt.Errorf("missing required database configuration. Please set DB_HOST, DB_USER, DB_NAME, and DB_PORT")
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode)
	
	log.Printf("Connecting to database: host=%s dbname=%s user=%s port=%s sslmode=%s", 
		dbHost, dbName, dbUser, dbPort, dbSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	_, err = migrations.RunMigrations(db)
	if err != nil {
		return nil, err
	}

	log.Println("Database migration completed successfully!")
	return db, nil
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func main() {
	// Connect Database
	db, err := setupDatabase()
	if err != nil {
		log.Fatalf("Failed to setup database: %v", err)
	}
	log.Println("Database initialized successfully!")

	// Initialize Layers
	participantRepo := repository.NewGormParticipantRepository(db)
	participantService := service.NewParticipantService(participantRepo)
	participantHandler := handler.NewParticipantHandler(participantService)

	// Setup Routes
	// Initialize Fiber app instead of Gin
	app := fiber.New()

	// Configure CORS
	origins := "http://localhost:3000,https://your-production-domain.com"
	if appEnv := os.Getenv("APP_ENV"); appEnv == "development" {
		origins = "http://localhost:3000"
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
		MaxAge:           86400, // Preflight cache duration (in seconds)
	}))

	// Setup Routes
	routes.SetupParticipantRoutes(app, participantHandler)

	// Start Server
	log.Println("Starting Participant Service on port 8081")
	if err := app.Listen(":8081"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
