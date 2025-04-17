package main

import (
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/rovin99/Survey-Platform/SurveyManagementService/models"
)

func main() {
	if err := godotenv.Load("../.env"); err != nil {
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
		log.Fatal("Failed to connect to database:", err)
	}

	// Clean up existing data
	log.Println("Cleaning up existing data...")
	db.Exec("DELETE FROM answers")
	db.Exec("DELETE FROM survey_sessions")
	db.Exec("DELETE FROM options")
	db.Exec("DELETE FROM questions")
	db.Exec("DELETE FROM surveys")
	log.Println("Cleanup complete. Starting to seed...")

	// Create a survey
	survey := &models.Survey{
		ConductorID:       1,
		Title:             "Student Demographics Survey",
		Description:       "A survey to understand student demographics at IITGN",
		IsSelfRecruitment: true,
		Status:            "PUBLISHED",
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	if err := db.Create(survey).Error; err != nil {
		log.Fatal("Failed to create survey:", err)
	}

	// Create questions
	questions := []models.Question{
		{
			SurveyID:     survey.SurveyID,
			QuestionText: "What is your gender?",
			QuestionType: "MULTIPLE_CHOICE",
			Mandatory:    true,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
		{
			SurveyID:     survey.SurveyID,
			QuestionText: "What is your age group?",
			QuestionType: "MULTIPLE_CHOICE",
			Mandatory:    true,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
		{
			SurveyID:     survey.SurveyID,
			QuestionText: "Which state are you from?",
			QuestionType: "MULTIPLE_CHOICE",
			Mandatory:    true,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
	}

	if err := db.Create(&questions).Error; err != nil {
		log.Fatal("Failed to create questions:", err)
	}

	// Create options
	genderOptions := []models.Option{
		{QuestionID: questions[0].QuestionID, OptionText: "Male"},
		{QuestionID: questions[0].QuestionID, OptionText: "Female"},
		{QuestionID: questions[0].QuestionID, OptionText: "Other"},
	}

	ageOptions := []models.Option{
		{QuestionID: questions[1].QuestionID, OptionText: "18-20"},
		{QuestionID: questions[1].QuestionID, OptionText: "21-23"},
		{QuestionID: questions[1].QuestionID, OptionText: "24-26"},
		{QuestionID: questions[1].QuestionID, OptionText: "27+"},
	}

	stateOptions := []models.Option{
		{QuestionID: questions[2].QuestionID, OptionText: "Gujarat"},
		{QuestionID: questions[2].QuestionID, OptionText: "Maharashtra"},
		{QuestionID: questions[2].QuestionID, OptionText: "Delhi"},
		{QuestionID: questions[2].QuestionID, OptionText: "Tamil Nadu"},
		{QuestionID: questions[2].QuestionID, OptionText: "Karnataka"},
	}

	if err := db.Create(&genderOptions).Error; err != nil {
		log.Fatal("Failed to create gender options:", err)
	}
	if err := db.Create(&ageOptions).Error; err != nil {
		log.Fatal("Failed to create age options:", err)
	}
	if err := db.Create(&stateOptions).Error; err != nil {
		log.Fatal("Failed to create state options:", err)
	}

	// Create some random responses
	genderDist := []int{60, 35, 5}         // 60% Male, 35% Female, 5% Other
	ageDist := []int{40, 35, 20, 5}        // Age distribution
	stateDist := []int{30, 25, 20, 15, 10} // State distribution

	// Create 100 responses
	for i := 0; i < 100; i++ {
		// Create a session
		session := models.SurveySession{
			SurveyID:      survey.SurveyID,
			ParticipantID: uint(i + 1),
			SessionStatus: "COMPLETED",
			CreatedAt:     time.Now().Add(-time.Duration(rand.Intn(30)) * 24 * time.Hour), // Random date in last 30 days
		}
		if err := db.Create(&session).Error; err != nil {
			log.Fatal("Failed to create session:", err)
		}

		// Create answers
		answers := []models.Answer{
			{
				SessionID:  session.SessionID,
				QuestionID: questions[0].QuestionID,
				Response:   genderOptions[weightedRandom(genderDist)].OptionText,
				CreatedAt:  session.CreatedAt,
			},
			{
				SessionID:  session.SessionID,
				QuestionID: questions[1].QuestionID,
				Response:   ageOptions[weightedRandom(ageDist)].OptionText,
				CreatedAt:  session.CreatedAt,
			},
			{
				SessionID:  session.SessionID,
				QuestionID: questions[2].QuestionID,
				Response:   stateOptions[weightedRandom(stateDist)].OptionText,
				CreatedAt:  session.CreatedAt,
			},
		}

		if err := db.Create(&answers).Error; err != nil {
			log.Fatal("Failed to create answers:", err)
		}
	}

	log.Println("Successfully seeded the database!")
}

func weightedRandom(weights []int) int {
	total := 0
	for _, w := range weights {
		total += w
	}

	r := rand.Intn(total)
	for i, w := range weights {
		r -= w
		if r < 0 {
			return i
		}
	}
	return len(weights) - 1
}
