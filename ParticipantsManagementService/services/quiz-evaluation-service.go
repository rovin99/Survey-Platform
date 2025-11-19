package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/rovin99/Survey-Platform/ParticipantsManagementService/repository"
)

type QuizEvaluationService interface {
	EvaluateQuiz(ctx context.Context, sessionID uint) (*QuizEvaluationResult, error)
}

type QuizEvaluationResult struct {
	SessionID        uint                   `json:"sessionId"`
	Score            int                    `json:"score"`
	TotalPoints      int                    `json:"totalPoints"`
	Percentage       float64                `json:"percentage"`
	Passed           bool                   `json:"passed"`
	CorrectCount     int                    `json:"correctCount"`
	TotalQuestions   int                    `json:"totalQuestions"`
	TimeTakenSeconds int                    `json:"timeTakenSeconds"`
	Results          []QuestionEvaluation   `json:"results"`
}

type QuestionEvaluation struct {
	QuestionID     uint        `json:"questionId"`
	QuestionText   string      `json:"questionText"`
	UserAnswer     interface{} `json:"userAnswer"`
	CorrectAnswer  interface{} `json:"correctAnswer"`
	IsCorrect      bool        `json:"isCorrect"`
	PointsEarned   int         `json:"pointsEarned"`
	PointsPossible int         `json:"pointsPossible"`
	Explanation    string      `json:"explanation,omitempty"`
}

type quizEvaluationServiceImpl struct {
	repo repository.ParticipantRepository
}

func NewQuizEvaluationService(repo repository.ParticipantRepository) QuizEvaluationService {
	return &quizEvaluationServiceImpl{repo: repo}
}

func (s *quizEvaluationServiceImpl) EvaluateQuiz(ctx context.Context, sessionID uint) (*QuizEvaluationResult, error) {
	// 1. Get session
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	// 2. Get all answers for this session
	answers, err := s.repo.GetAnswersBySessionID(ctx, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get answers: %w", err)
	}

	// 3. Fetch survey with questions from SurveyManagementService
	survey, err := s.fetchSurveyWithQuestions(session.SurveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch survey: %w", err)
	}

	// 4. Create question map for easy lookup
	questionMap := make(map[uint]*QuestionFromAPI)
	totalPoints := 0
	for i := range survey.Questions {
		q := &survey.Questions[i]
		questionMap[q.ID] = q
		if q.Points > 0 {
			totalPoints += q.Points
		} else {
			totalPoints += 1 // default 1 point
		}
	}

	// 5. Evaluate each answer
	var totalScore int
	var correctCount int
	var results []QuestionEvaluation

	for _, answer := range answers {
		question := questionMap[answer.QuestionID]
		if question == nil {
			continue // Skip if question not found
		}

		// Parse user's answer
		var userAnswer interface{}
		json.Unmarshal(answer.ResponseData, &userAnswer)

		// Parse correct answer
		var correctAnswer interface{}
		json.Unmarshal([]byte(question.CorrectAnswers), &correctAnswer)

		// Evaluate if correct
		isCorrect := s.evaluateAnswer(userAnswer, correctAnswer, question.QuestionType)

		points := question.Points
		if points == 0 {
			points = 1 // default
		}

		pointsEarned := 0
		if isCorrect {
			pointsEarned = points
			totalScore += pointsEarned
			correctCount++
		}

		results = append(results, QuestionEvaluation{
			QuestionID:     question.ID,
			QuestionText:   question.QuestionText,
			UserAnswer:     userAnswer,
			CorrectAnswer:  correctAnswer,
			IsCorrect:      isCorrect,
			PointsEarned:   pointsEarned,
			PointsPossible: points,
			Explanation:    question.Explanation,
		})
	}

	// 6. Calculate percentage and pass/fail
	percentage := 0.0
	if totalPoints > 0 {
		percentage = (float64(totalScore) / float64(totalPoints)) * 100
	}

	passed := false
	if survey.PassingScorePercentage != nil {
		passed = percentage >= float64(*survey.PassingScorePercentage)
	}

	// 7. Calculate time taken
	timeTaken := int(session.UpdatedAt.Sub(session.CreatedAt).Seconds())

	return &QuizEvaluationResult{
		SessionID:        sessionID,
		Score:            totalScore,
		TotalPoints:      totalPoints,
		Percentage:       percentage,
		Passed:           passed,
		CorrectCount:     correctCount,
		TotalQuestions:   len(survey.Questions),
		TimeTakenSeconds: timeTaken,
		Results:          results,
	}, nil
}

func (s *quizEvaluationServiceImpl) evaluateAnswer(userAnswer, correctAnswer interface{}, questionType string) bool {
	// Convert to comparable strings
	userStr := fmt.Sprint(userAnswer)
	correctStr := fmt.Sprint(correctAnswer)

	switch questionType {
	case "single-choice":
		// Direct comparison for single choice
		return userStr == correctStr

	case "multiple-choice":
		// Compare arrays (order doesn't matter)
		userArr, ok1 := userAnswer.([]interface{})
		correctArr, ok2 := correctAnswer.([]interface{})

		if !ok1 || !ok2 {
			// Try parsing as numbers
			return userStr == correctStr
		}

		if len(userArr) != len(correctArr) {
			return false
		}

		// Convert to sets
		userSet := make(map[string]bool)
		for _, v := range userArr {
			userSet[fmt.Sprint(v)] = true
		}

		for _, v := range correctArr {
			if !userSet[fmt.Sprint(v)] {
				return false
			}
		}
		return true

	case "text":
		// Case-insensitive text comparison
		userLower := strings.ToLower(strings.TrimSpace(userStr))
		correctLower := strings.ToLower(strings.TrimSpace(correctStr))
		return userLower == correctLower

	default:
		// Default to string comparison
		return userStr == correctStr
	}
}

func (s *quizEvaluationServiceImpl) fetchSurveyWithQuestions(surveyID uint) (*SurveyDetailFromAPI, error) {
	// Get Survey Service URL
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:3002"
	}

	url := fmt.Sprintf("%s/api/v1/surveys/%d", surveyServiceURL, surveyID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("survey service returned status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Success bool                 `json:"success"`
		Data    SurveyDetailFromAPI  `json:"data"`
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if !response.Success {
		return nil, fmt.Errorf("failed to fetch survey")
	}

	return &response.Data, nil
}
