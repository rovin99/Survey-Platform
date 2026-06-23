package main

// CI/CD Pipeline Test - SurveyManagementService updated for end-to-end testing
import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	middlewares "github.com/rovin99/Survey-Platform/SurveyManagementService/Middlewares"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/routes"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/Utils/storage"
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

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, err
	}

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
		&models.SurveyInvitation{},
	)
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

type AllRepositories struct {
	SurveyRepo      repository.SurveyRepository
	SurveyDraftRepo repository.SurveyDraftRepository
	QuestionRepo    repository.QuestionRepository
	OptionRepo      repository.OptionRepository
	AnswerRepo      repository.AnswerRepository
	SessionRepo     repository.SurveySessionRepository
	AccessRepo      repository.SurveyAccessRepository
	MediaRepo       repository.SurveyMediaRepository
}

type AllServices struct {
	SurveyService   service.SurveyService
	QuestionService service.QuestionService
	OptionService   service.OptionService
	AnswerService   service.AnswerService
	AccessService   service.SurveyAccessService
}

type AllHandlers struct {
	SurveyHandler     *handler.SurveyHandler
	QuestionHandler   *handler.QuestionHandler
	OptionHandler     *handler.OptionHandler
	AnswerHandler     *handler.AnswerHandler
	EmailHandler      *handler.EmailHandler
	AccessHandler     *handler.SurveyAccessHandler
	InvitationHandler *handler.InvitationHandler
	OTPHandler        *handler.OTPHandler
	MediaHandler      *handler.MediaHandler
}

func setupRepositories(db *gorm.DB) AllRepositories {
	return AllRepositories{
		SurveyRepo:      repository.NewSurveyRepository(db),
		SurveyDraftRepo: repository.NewSurveyDraftRepository(db),
		QuestionRepo:    repository.NewQuestionRepository(db),
		OptionRepo:      repository.NewOptionRepository(db),
		AnswerRepo:      repository.NewAnswerRepository(db),
		SessionRepo:     repository.NewSurveySessionRepository(db),
		AccessRepo:      repository.NewSurveyAccessRepository(db),
		MediaRepo:       repository.NewSurveyMediaRepository(db),
	}
}

func setupServices(repos AllRepositories) AllServices {
	return AllServices{
		SurveyService:   service.NewSurveyService(repos.SurveyRepo, repos.SurveyDraftRepo),
		QuestionService: service.NewQuestionService(repos.QuestionRepo, repos.OptionRepo, repos.SurveyRepo),
		OptionService:   service.NewOptionService(repos.OptionRepo),
		AnswerService:   service.NewAnswerService(repos.AnswerRepo, repos.QuestionRepo, repos.SessionRepo),
		AccessService:   service.NewSurveyAccessService(repos.AccessRepo, repos.SurveyRepo),
	}
}

func setupHandlers(services AllServices, repos AllRepositories, db *gorm.DB) AllHandlers {
	emailService := service.NewEmailService()
	invitationService := service.NewInvitationService(db, emailService)

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
	mediaService := service.NewMediaService(storageClient, repos.MediaRepo)

	return AllHandlers{
		SurveyHandler:     handler.NewSurveyHandler(services.SurveyService),
		QuestionHandler:   handler.NewQuestionHandler(services.QuestionService),
		OptionHandler:     handler.NewOptionHandler(services.OptionService),
		AnswerHandler:     handler.NewAnswerHandler(services.AnswerService),
		EmailHandler:      handler.NewEmailHandler(emailService),
		AccessHandler:     handler.NewSurveyAccessHandler(services.AccessService),
		InvitationHandler: handler.NewInvitationHandler(invitationService),
		OTPHandler:        handler.NewOTPHandler(service.NewOTPService(emailService), services.AccessService),
		MediaHandler:      handler.NewMediaHandler(mediaService),
	}
}

func main() {
	db, err := setupDatabase()
	if err != nil {
		log.Fatal("Failed to setup database:", err)
	}

	repos := setupRepositories(db)
	services := setupServices(repos)
	handlers := setupHandlers(services, repos, db)

	app := fiber.New(fiber.Config{
		BodyLimit: 6 * 1024 * 1024, // 6MB to allow 5MB files + form overhead
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			log.Printf("Error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "An internal error occurred",
				"error":   err.Error(),
			})
		},
	})

	// Configure CORS to allow credentials from frontend
	corsOrigins := getEnvOrDefault("CORS_ORIGINS", "http://localhost:3000")
	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS,PATCH",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,Cookie",
		AllowCredentials: true,
		ExposeHeaders:    "Content-Length,Content-Type,Set-Cookie",
		MaxAge:           3600,
	}))

	// Custom logger middleware to properly log request bodies
	app.Use(func(c *fiber.Ctx) error {
		// Store the request body for logging
		body := c.Body()

		// Record start time
		start := time.Now()

		// Process the request
		err := c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Log the request with body content
		log.Printf(
			"%s | %d | %s | %s | %s | %s",
			time.Now().Format("15:04:05"),
			c.Response().StatusCode(),
			duration.String(),
			c.IP(),
			c.Method(),
			c.Path(),
		)

		// Only log body for specific endpoints and if not empty
		if (c.Method() == "POST" || c.Method() == "PUT") && len(body) > 0 {
			// Try to pretty print JSON
			var prettyJSON bytes.Buffer
			if json.Indent(&prettyJSON, body, "", "  ") == nil {
				log.Printf("Request Body: %s", prettyJSON.String())
			} else {
				// If not valid JSON, log as is
				log.Printf("Request Body: %s", string(body))
			}
		}

		return err
	})

	// Keep the default logger for other logging
	app.Use(logger.New())
	app.Use(recover.New())

	// Health check endpoints for K-Native probes (no auth required)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "healthy",
			"service":   "survey-management-service",
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
				"error":  "database connection failed",
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

	app.Get("/health/startup", func(c *fiber.Ctx) error {
		// Comprehensive startup check
		sqlDB, err := db.DB()
		if err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "startup failed",
				"error":  "database connection failed",
			})
		}

		if err := sqlDB.Ping(); err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "startup failed",
				"error":  "database ping failed",
			})
		}

		// Check if migrations are applied (simple table existence check)
		if err := db.Raw("SELECT 1 FROM surveys LIMIT 1").Error; err != nil {
			return c.Status(503).JSON(fiber.Map{
				"status": "startup failed",
				"error":  "database tables not ready",
			})
		}

		return c.JSON(fiber.Map{
			"status":    "started",
			"timestamp": time.Now().Unix(),
		})
	})

	// Create API group for public routes (no authentication)
	publicApi := app.Group("/api")

	// Setup email routes without authentication (for AuthService to call)
	routes.SetupEmailRoutes(publicApi, handlers.EmailHandler)

	// Rate limiting for public survey access endpoints
	// Prevents brute force attacks and abuse of share links
	publicSurveyLimiter := limiter.New(limiter.Config{
		Max:        10,              // 10 requests
		Expiration: 1 * time.Minute, // per minute
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() // Rate limit by IP address
		},
		LimitReached: func(c *fiber.Ctx) error {
			log.Printf("[RATE_LIMIT] IP %s exceeded rate limit for public survey access", c.IP())
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error":   "Too many requests",
				"message": "Rate limit exceeded. Please try again in a minute.",
			})
		},
	})

	// Public access validation (no authentication - for anonymous users)
	// Apply rate limiting to prevent abuse
	publicApi.Post("/v1/surveys/public/validate-access", publicSurveyLimiter, handlers.AccessHandler.ValidateAccess)
	publicApi.Post("/v1/surveys/public/validate-invitation", publicSurveyLimiter, handlers.AccessHandler.ValidateInvitation)
	
	// OTP verification for organization access (public, rate limited)
	publicApi.Post("/v1/surveys/public/send-otp", publicSurveyLimiter, handlers.OTPHandler.SendOTP)
	publicApi.Post("/v1/surveys/public/verify-otp", publicSurveyLimiter, handlers.OTPHandler.VerifyOTP)

	// Internal API endpoints for service-to-service communication
	// These use API key authentication instead of JWT
	internalApi := app.Group("/internal/api/v1")
	internalApi.Use(middlewares.InternalAPIKeyMiddleware())
	internalApi.Get("/surveys/:id", handlers.SurveyHandler.GetSurveyInternal)
	internalApi.Get("/surveys/:surveyId/access-logs", handlers.AccessHandler.GetAccessLogsInternal)
	internalApi.Post("/surveys/:surveyId/invitation/complete", handlers.InvitationHandler.MarkInvitationCompleted)

	// Create a new group for authenticated routes with v1 prefix
	api := app.Group("/api/v1")
	api.Use(middlewares.AuthMiddleware())

	// Setup all routes under the authenticated group
	routes.SetupSurveyRoutes(api, handlers.SurveyHandler)
	routes.SetupDraftRoutes(api, handlers.SurveyHandler)
	routes.SetupQuestionRoutes(api, handlers.QuestionHandler)
	routes.SetupOptionRoutes(api, handlers.OptionHandler)
	routes.SetupAnswerRoutes(api, handlers.AnswerHandler)

	// Survey invitation routes (conductor endpoints - authenticated)
	routes.SetupInvitationRoutes(app, handlers.InvitationHandler)

	// Media upload route (authenticated)
	api.Post("/media/upload", handlers.MediaHandler.UploadMedia)

	// Survey sharing routes (conductor endpoints - authenticated)
	api.Post("/surveys/:surveyId/sharing/enable", handlers.AccessHandler.EnableSharing)
	api.Put("/surveys/:surveyId/sharing", handlers.AccessHandler.UpdateSharing)
	api.Delete("/surveys/:surveyId/sharing", handlers.AccessHandler.DisableSharing)
	api.Get("/surveys/:surveyId/sharing", handlers.AccessHandler.GetSharingInfo)
	api.Get("/surveys/:surveyId/sharing/logs", handlers.AccessHandler.GetAccessLogs)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3002"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
