// package main

// import (
// 	"log"
// 	"os"
// 	"github.com/gofiber/fiber/v2"
// 	"github.com/joho/godotenv"
// 	"gorm.io/driver/postgres"
// 	"gorm.io/gorm"
// 	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
// 	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
// 	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	
// )

// func main() {
// 	// Load environment variables from .env file
// 	err := godotenv.Load()
// 	if err != nil {
// 		log.Fatal("Error loading .env file:", err)
// 	}

// 	// Database connection details
// 	dbHost := os.Getenv("DB_HOST")
// 	dbUser := os.Getenv("DB_USER")
// 	dbPassword := os.Getenv("DB_PASSWORD")
// 	dbName := os.Getenv("DB_NAME")
// 	dbPort := os.Getenv("DB_PORT")
// 	dbSSLMode := os.Getenv("DB_SSLMODE")

// 	// Construct DSN
// 	dsn := "host=" + dbHost + " user=" + dbUser + " password=" + dbPassword + " dbname=" + dbName + " port=" + dbPort + " sslmode=" + dbSSLMode

// 	// Connect to the database
// 	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
// 	if err != nil {
// 		log.Fatal("Failed to connect to database:", err)
// 	}

// 	// migrations.MigrateConductorTable(db)
// 	// migrations.MigrateSurveyTables(db)
// 	// Initialize Fiber app
// 	app := fiber.New()

// 	// Initialize repositories and services
// 	surveyRepo := repository.NewSurveyRepository(db)
// 	questionRepo := repository.NewQuestionRepository(db)
// 	// sessionRepo := repository.NewSessionRepository(db)

// 	surveyService := service.NewSurveyService(surveyRepo, questionRepo)
// 	// sessionService := service.NewSessionService(sessionRepo, surveyRepo)

// 	// Initialize handlers
// 	surveyHandler := handler.NewSurveyHandler(surveyService)
// 	// sessionHandler := handler.NewSessionHandler(sessionService)

// 	// Setup routes
// 	api := app.Group("/api/v1")

// 	// Survey routes
// 	survey := api.Group("/surveys")
// 	survey.Post("/", surveyHandler.CreateSurvey)
// 	survey.Get("/", surveyHandler.ListSurveys)
// 	survey.Get("/:id", surveyHandler.GetSurvey)
// 	survey.Put("/:id", surveyHandler.UpdateSurvey)
// 	survey.Delete("/:id", surveyHandler.DeleteSurvey)

// 	app.Get("/surveys", surveyHandler.ListSurveys)
// 	app.Put("/survey/:id", surveyHandler.UpdateSurvey)
// 	app.Delete("/survey/:id", surveyHandler.DeleteSurvey)

// 	conductors := api.Group("/conductors")

//     conductors.Post("/", conductorHandler.RegisterConductor)
//     conductors.Get("/:id", conductorHandler.GetConductor)
//     conductors.Put("/:id", conductorHandler.UpdateConductor)
//     conductors.Delete("/:id", conductorHandler.DeleteConductor)
//     conductors.Get("/", conductorHandler.ListConductors)
//     conductors.Post("/:id/verify", conductorHandler.VerifyEmail)

// 	// Uncomment and implement as needed
// 	// app.Post("/survey/:id/question", surveyHandler.AddQuestion)
// 	// app.Put("/survey/:id/question/:questionID", surveyHandler.UpdateQuestion)
// 	// app.Delete("/survey/:id/question/:questionID", surveyHandler.DeleteQuestion)

// 	log.Fatal(app.Listen(":3000"))
// }


package main

import (
	"log"
	"os"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"github.com/go-redis/redis/v8"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/service"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
	"github.com/rovin99/Survey-Platform/SurveyManagementService/middlewares"
	
	"strconv"
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

	// Redis connection details
	redisAddr := os.Getenv("REDIS_ADDR")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisDB := os.Getenv("REDIS_DB")

	Auth_Service_URL := os.Getenv("AUTH_SERVICE_URL")

	// Construct DSN for PostgreSQL
	dsn := "host=" + dbHost + " user=" + dbUser + " password=" + dbPassword + " dbname=" + dbName + " port=" + dbPort + " sslmode=" + dbSSLMode

	// Connect to the database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	redisDBInt, err := strconv.Atoi(redisDB)
	if err != nil {
		log.Fatalf("Invalid REDIS_DB value: %v", err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDBInt, // Use the integer value here
	})

	// Initialize EmailService
	emailService := service.NewEmailService()

	// Initialize AuthService (assuming this is implemented similarly to EmailService)
	authService := service.NewAuthService( Auth_Service_URL)

	// Initialize repositories and services
	conductorRepo := repository.NewConductorRepository(db)
	surveyRepo := repository.NewSurveyRepository(db)
	questionRepo := repository.NewQuestionRepository(db)

	surveyService := service.NewSurveyService(surveyRepo, questionRepo)

	// Initialize the ConductorService with all required dependencies
	conductorService := service.NewConductorService(conductorRepo, emailService, rdb, authService)

	// Initialize handlers
	surveyHandler := handler.NewSurveyHandler(surveyService)
	conductorHandler := handler.NewConductorHandler(conductorService)

	// Setup routes
	app := fiber.New()
	api := app.Group("/api/v1", middleware.RequireAuth())

	// Survey routes
	survey := api.Group("/surveys")
	survey.Post("/", surveyHandler.CreateSurvey)
	survey.Get("/", surveyHandler.ListSurveys)
	survey.Get("/:id", surveyHandler.GetSurvey)
	survey.Put("/:id", surveyHandler.UpdateSurvey)
	survey.Delete("/:id", surveyHandler.DeleteSurvey)

	// Conductor routes
	conductors := api.Group("/conductors")
	conductors.Post("/", conductorHandler.RegisterConductor)
	conductors.Get("/:id", conductorHandler.GetConductor)
	conductors.Put("/:id", conductorHandler.UpdateConductor)
	conductors.Delete("/:id", conductorHandler.DeleteConductor)
	conductors.Get("/", conductorHandler.ListConductors)
	conductors.Post("/:id/verify", conductorHandler.VerifyEmail)

	// Start the server
	log.Fatal(app.Listen(":3000"))
}
