package main

import (
    "log"
    "os"

    "github.com/gofiber/fiber/v2"
    "github.com/gofiber/fiber/v2/middleware/cors"
    "github.com/gofiber/fiber/v2/middleware/logger"
    "github.com/gofiber/fiber/v2/middleware/recover"
    "github.com/joho/godotenv"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"

    "github.com/rovin99/Survey-Platform/SurveyManagementService/repository"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/service"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/handler"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/models"
    "github.com/rovin99/Survey-Platform/SurveyManagementService/routes"
)

func setupDatabase() (*gorm.DB, error) {
    if err := godotenv.Load(); err != nil {
        log.Fatal("Error loading .env file:", err)
    }

    dsn := "host=" + os.Getenv("DB_HOST") +
        " user=" + os.Getenv("DB_USER") +
        " password=" + os.Getenv("DB_PASSWORD") +
        " dbname=" + os.Getenv("DB_NAME") +
        " port=" + os.Getenv("DB_PORT") +
        " sslmode=" + os.Getenv("DB_SSLMODE")

    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        return nil, err
    }

    err = db.AutoMigrate(
        &models.Survey{},
        &models.Question{},
        &models.SurveyRequirement{},
        &models.Answer{},
        &models.SurveySession{},
        &models.SurveyMediaFile{},
        &models.SurveyDraft{},
        &models.BranchingRule{},
    )
    if err != nil {
        return nil, err
    }

    log.Println("Database migration completed successfully!")
    return db, nil
}

func setupRepositories(db *gorm.DB) (repository.SurveyRepository, repository.SurveyDraftRepository) {
    return repository.NewSurveyRepository(db), repository.NewSurveyDraftRepository(db)
}

func setupServices(surveyRepo repository.SurveyRepository, surveyDraftRepo repository.SurveyDraftRepository) service.SurveyService {
    return service.NewSurveyService(surveyRepo, surveyDraftRepo)
}

func setupHandlers(surveyService service.SurveyService) *handler.SurveyHandler {
    return handler.NewSurveyHandler(surveyService)
}

func main() {
    db, err := setupDatabase()
    if err != nil {
        log.Fatal("Failed to setup database:", err)
    }

    surveyRepo, surveyDraftRepo := setupRepositories(db)
    surveyService := setupServices(surveyRepo, surveyDraftRepo)
    surveyHandler := setupHandlers(surveyService)

    app := fiber.New(fiber.Config{
        ErrorHandler: func(c *fiber.Ctx, err error) error {
            log.Printf("Error: %v", err)
            return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
                "success": false,
                "message": "An internal error occurred",
                "error":   err.Error(),
            })
        },
    })

    app.Use(cors.New())
    app.Use(logger.New())
    app.Use(recover.New())

    routes.SetupSurveyRoutes(app, surveyHandler)

    port := os.Getenv("PORT")
    if port == "" {
        port = "3000"
    }

    log.Printf("Server starting on port %s", port)
    log.Fatal(app.Listen(":" + port))
}
