package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
)

// SetupQuestionRoutes registers routes for question management
func SetupQuestionRoutes(app *fiber.App, questionHandler *handler.QuestionHandler) {
	questionGroup := app.Group("/api/questions")

	// Create a new question
	questionGroup.Post("/", questionHandler.CreateQuestion)

	// Get a question by ID
	questionGroup.Get("/:id", questionHandler.GetQuestion)

	// Get questions by survey ID
	questionGroup.Get("/survey/:survey_id", questionHandler.GetQuestionsBySurvey)

	// Update a question
	questionGroup.Put("/:id", questionHandler.UpdateQuestion)

	// Delete a question
	questionGroup.Delete("/:id", questionHandler.DeleteQuestion)
}

// SetupOptionRoutes registers routes for option management
func SetupOptionRoutes(app *fiber.App, optionHandler *handler.OptionHandler) {
	optionGroup := app.Group("/api/options")

	// Create a new option
	optionGroup.Post("/", optionHandler.CreateOption)

	// Batch create options
	optionGroup.Post("/batch", optionHandler.BatchCreateOptions)

	// Get an option by ID
	optionGroup.Get("/:id", optionHandler.GetOption)

	// Get options by question ID
	optionGroup.Get("/question/:question_id", optionHandler.GetOptionsByQuestion)

	// Update an option
	optionGroup.Put("/:id", optionHandler.UpdateOption)

	// Delete an option
	optionGroup.Delete("/:id", optionHandler.DeleteOption)
}

// SetupAnswerRoutes registers routes for answer management
func SetupAnswerRoutes(app *fiber.App, answerHandler *handler.AnswerHandler) {
	answerGroup := app.Group("/api/answers")

	// Create a new answer
	answerGroup.Post("/", answerHandler.CreateAnswer)

	// Submit bulk answers
	answerGroup.Post("/bulk", answerHandler.SubmitBulkAnswers)

	// Get answers by session ID
	answerGroup.Get("/session/:session_id", answerHandler.GetAnswersBySession)

	// Get answers by question ID
	answerGroup.Get("/question/:question_id", answerHandler.GetAnswersByQuestion)
}
