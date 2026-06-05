package main

// CI/CD Pipeline Test - ParticipantsManagementService updated for end-to-end testing
import (
	"fmt"
	"log"
	"os"
	"time"

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
	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/utils/storage"
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

	// Initialize quiz evaluation service
	quizEvalService := service.NewQuizEvaluationService(participantRepo)
	participantHandler.SetQuizEvaluationService(quizEvalService)
	participantService.SetQuizEvaluationService(quizEvalService)

	// Initialize MinIO storage client for media uploads
	storageClient, err := storage.NewStorageClient(
		getEnvOrDefault("MINIO_ENDPOINT", "localhost:9000"),
		getEnvOrDefault("MINIO_ACCESS_KEY", "minioadmin"),
		getEnvOrDefault("MINIO_SECRET_KEY", "minioadmin"),
		getEnvOrDefault("MINIO_BUCKET", "survey-uploads"),
		getEnvOrDefault("MINIO_USE_SSL", "false") == "true",
	)
	if err != nil {
		log.Printf("WARNING: MinIO storage not available: %v (media uploads will fail)", err)
	}
	mediaService := service.NewMediaService(storageClient)
	mediaHandler := handler.NewMediaHandler(mediaService)

	// Initialize manual evaluation layers (for conductor grading)
	evalRepo := repository.NewEvaluationRepository(db)
	evalService := service.NewEvaluationService(evalRepo, participantRepo)
	evalHandler := handler.NewEvaluationHandler(evalService)
	participantService.SetEvaluationRepo(evalRepo)

	// Setup Routes
	// Initialize Fiber app instead of Gin
	app := fiber.New()

	// Configure CORS - use CORS_ORIGINS env var or default to localhost:3000
	corsOrigins := getEnvOrDefault("CORS_ORIGINS", "http://localhost:3000")
	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,Cookie",
		AllowCredentials: true,
		ExposeHeaders:    "Set-Cookie",
		MaxAge:           86400,
	}))

	// Health check endpoints (no auth required)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "healthy",
			"service":   "participants-management-service",
			"timestamp": time.Now().Unix(),
		})
	})

	app.Get("/health/live", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "alive",
			"timestamp": time.Now().Unix(),
		})
	})

	app.Get("/health/ready", func(c *fiber.Ctx) error {
		// Check database connectivity
		sqlDB, err := db.DB()
		if err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "not ready",
				"error":  "database connection error",
			})
		}
		if err := sqlDB.Ping(); err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "not ready",
				"error":  "database ping failed",
			})
		}
		return c.JSON(fiber.Map{
			"status":    "ready",
			"timestamp": time.Now().Unix(),
		})
	})

	// Setup evaluation routes FIRST (before session routes, so they match before
	// SessionTokenMiddleware catches /sessions/:sessionId/* patterns)
	routes.SetupEvaluationRoutes(app, evalHandler)

	// Setup participant/session routes (includes SessionTokenMiddleware for session-scoped endpoints)
	routes.SetupParticipantRoutes(app, participantHandler, mediaHandler, participantRepo)

	// Start Server
	port := getEnvOrDefault("PORT", "8080")
	log.Printf("Starting Participant Service on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
