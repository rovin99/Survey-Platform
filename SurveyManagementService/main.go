package main

import (
	"log"
	"os"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/middlewares"
	
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file:", err)
	}

	// Database connection details
	dbHost := os.Getenv("DB_HOST")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbPort := os.Getenv("DB_PORT")
	dbSSLMode := os.Getenv("DB_SSLMODE")


	// Construct DSN for PostgreSQL
	dsn := "host=" + dbHost + " user=" + dbUser + " password=" + dbPassword + " dbname=" + dbName + " port=" + dbPort + " sslmode=" + dbSSLMode

	// Connect to the database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	

	

	// Initialize services
	emailService := service.NewEmailService()
	
	
	surveyRepo := repository.NewSurveyRepository(db)
	questionRepo := repository.NewQuestionRepository(db)

	// Initialize business services
	surveyService := service.NewSurveyService(surveyRepo, questionRepo)
	

	// Initialize handlers
	surveyHandler := handler.NewSurveyHandler(surveyService)
	
	emailHandler := handler.NewEmailHandler(emailService)

	// Setup Fiber app with custom error handling
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			// Log the error
			log.Printf("Error: %v", err)
			
			// Return a generic error response
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"success": false,
				"message": "An internal error occurred",
				"error":   err.Error(),
			})
		},
	})

	// API routes with authentication
	api := app.Group("/api/v1", middleware.RequireAuth())

	// Email routes - no auth required for email verification
	emailRoutes := app.Group("/email")
	emailRoutes.Post("/verify", emailHandler.SendVerificationEmail)

	// Survey routes - auth required
	surveyRoutes := api.Group("/surveys")
	surveyRoutes.Post("/", surveyHandler.CreateSurvey)
	surveyRoutes.Get("/", surveyHandler.ListSurveys)
	surveyRoutes.Get("/:id", surveyHandler.GetSurvey)
	surveyRoutes.Put("/:id", surveyHandler.UpdateSurvey)
	surveyRoutes.Delete("/:id", surveyHandler.DeleteSurvey)


	// Start the server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	
	log.Printf("Server starting on port %s", port)
	log.Fatal(app.Listen(":" + port))
}