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

	// Construct DSN
	dsn := "host=" + dbHost + " user=" + dbUser + " password=" + dbPassword + " dbname=" + dbName + " port=" + dbPort + " sslmode=" + dbSSLMode

	// Connect to the database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Initialize Fiber app
	app := fiber.New()

	// Initialize repositories and services
	surveyRepo := repository.NewSurveyRepository(db)
	questionRepo := repository.NewQuestionRepository(db)
	// sessionRepo := repository.NewSessionRepository(db)

	surveyService := service.NewSurveyService(surveyRepo, questionRepo)
	// sessionService := service.NewSessionService(sessionRepo, surveyRepo)

	// Initialize handlers
	surveyHandler := handler.NewSurveyHandler(surveyService)
	// sessionHandler := handler.NewSessionHandler(sessionService)

	// Setup routes
	api := app.Group("/api/v1")

	// Survey routes
	survey := api.Group("/surveys")
	survey.Post("/", surveyHandler.CreateSurvey)
	survey.Get("/", surveyHandler.ListSurveys)
	survey.Get("/:id", surveyHandler.GetSurvey)
	survey.Put("/:id", surveyHandler.UpdateSurvey)
	survey.Delete("/:id", surveyHandler.DeleteSurvey)

	app.Get("/surveys", surveyHandler.ListSurveys)
	app.Put("/survey/:id", surveyHandler.UpdateSurvey)
	app.Delete("/survey/:id", surveyHandler.DeleteSurvey)

	// Uncomment and implement as needed
	// app.Post("/survey/:id/question", surveyHandler.AddQuestion)
	// app.Put("/survey/:id/question/:questionID", surveyHandler.UpdateQuestion)
	// app.Delete("/survey/:id/question/:questionID", surveyHandler.DeleteQuestion)

	log.Fatal(app.Listen(":3000"))
}
