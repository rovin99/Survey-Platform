package main

import (
	"log"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/driver/postgres"
)

func main() {
	app := fiber.New()
	
	// Database connection
	dsn := "host=localhost user=postgres password=postgres dbname=survey_db port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Initialize repositories and services
	surveyRepo := repository.NewSurveyRepository(db)
	questionRepo := repository.NewQuestionRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	
	surveyService := service.NewSurveyService(surveyRepo, questionRepo)
	sessionService := service.NewSessionService(sessionRepo, surveyRepo)
	
	// Initialize handlers
	surveyHandler := handler.NewSurveyHandler(surveyService)
	sessionHandler := handler.NewSessionHandler(sessionService)

	// Setup routes
	api := app.Group("/api/v1")
	
	// Survey routes
	survey := api.Group("/surveys")
	survey.Post("/", surveyHandler.CreateSurvey)
	survey.Get("/", surveyHandler.ListSurveys)
	survey.Get("/:id", surveyHandler.GetSurvey)
	survey.Put("/:id", surveyHandler.UpdateSurvey)
	survey.Delete("/:id", surveyHandler.DeleteSurvey)
	
	// Question routes
	survey.Post("/:id/questions", surveyHandler.AddQuestion)
	survey.Put("/:id/questions/:questionId", surveyHandler.UpdateQuestion)
	survey.Delete("/:id/questions/:questionId", surveyHandler.DeleteQuestion)
	
	// Session routes
	session := api.Group("/sessions")
	session.Post("/", sessionHandler.CreateSession)
	session.Get("/:id", sessionHandler.GetSession)
	session.Post("/:id/answers", sessionHandler.SubmitAnswer)

	log.Fatal(app.Listen(":3000"))
}