package main

import (
	"log"
	"os"

	
	"github.com/gofiber/fiber/v2"
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
	_, err = migrations.RunMigrations(db)
	if err != nil {
		return nil, err
	}

	log.Println("Database migration completed successfully!")
	return db, nil
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

	
	// Setup Routes
	routes.SetupParticipantRoutes(app, participantHandler)

	// Start Server
	log.Println("Starting Participant Service on port 8081")
	if err := app.Listen(":8081"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
