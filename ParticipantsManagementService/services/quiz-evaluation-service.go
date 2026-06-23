package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

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
	QuestionID         uint        `json:"questionId"`
	QuestionText       string      `json:"questionText"`
	QuestionType       string      `json:"questionType"`
	UserAnswer         interface{} `json:"userAnswer"`
	CorrectAnswer      interface{} `json:"correctAnswer"`
	IsCorrect          bool        `json:"isCorrect"`
	PointsEarned       int         `json:"pointsEarned"`
	PointsPossible     int         `json:"pointsPossible"`
	PendingEvaluation  bool        `json:"pendingEvaluation"`
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
		// Handle double-encoding: response_data might be stored as a JSON string containing JSON
		var userAnswerWrapper map[string]interface{}
		responseData := answer.ResponseData

		var unescapedJSON string
		if err := json.Unmarshal(responseData, &unescapedJSON); err == nil {
			json.Unmarshal([]byte(unescapedJSON), &userAnswerWrapper)
		} else {
			json.Unmarshal(responseData, &userAnswerWrapper)
		}

		points := question.Points
		if points == 0 {
			points = 1
		}

		// Handle non-auto-gradable question types (code, rating, image-upload, text without correct answer)
		if question.QuestionType == "code" || question.QuestionType == "rating" || question.QuestionType == "image-upload" ||
			(question.QuestionType == "text" && question.CorrectAnswers == "") {

			// Extract display value — answers are wrapped as {"value": actualAnswer}
			var userDisplay interface{}
			rawValue := userAnswerWrapper["value"]

			if question.QuestionType == "code" {
				// Code answer: {"value": {"code": "...", "language": "python"}}
				codeMap, _ := rawValue.(map[string]interface{})
				codeStr, _ := codeMap["code"].(string)
				langStr, _ := codeMap["language"].(string)

				// Try to run server-side test cases if available
				var testCaseResults []map[string]interface{}
				passedCount := 0
				totalTests := 0

				if question.CorrectAnswers != "" {
					var codeSettings struct {
						TestCases []struct {
							ID             string `json:"id"`
							Input          string `json:"input"`
							ExpectedOutput string `json:"expectedOutput"`
							Hidden         bool   `json:"hidden"`
						} `json:"testCases"`
					}
					if err := json.Unmarshal([]byte(question.CorrectAnswers), &codeSettings); err == nil && len(codeSettings.TestCases) > 0 {
						totalTests = len(codeSettings.TestCases)
						for _, tc := range codeSettings.TestCases {
							result := s.executeCodeViaPiston(langStr, codeStr, tc.Input)
							passed := strings.TrimSpace(result.Stdout) == strings.TrimSpace(tc.ExpectedOutput)
							if passed {
								passedCount++
							}
							testCaseResults = append(testCaseResults, map[string]interface{}{
								"input":          tc.Input,
								"expectedOutput": tc.ExpectedOutput,
								"actualOutput":   strings.TrimSpace(result.Stdout),
								"passed":         passed,
								"hidden":         tc.Hidden,
								"error":          result.Stderr,
							})
						}
					}
				}

				// Auto-grade if all test cases pass
				pointsEarned := 0
				allPassed := totalTests > 0 && passedCount == totalTests
				if allPassed {
					pointsEarned = points
					totalScore += pointsEarned
					correctCount++
				}

				testSummary := ""
				if totalTests > 0 {
					testSummary = fmt.Sprintf("%d/%d test cases passed", passedCount, totalTests)
				}

				results = append(results, QuestionEvaluation{
					QuestionID:        question.ID,
					QuestionText:      question.QuestionText,
					QuestionType:      question.QuestionType,
					UserAnswer:        map[string]interface{}{"code": codeStr, "language": langStr, "testResults": testCaseResults, "testSummary": testSummary},
					CorrectAnswer:     testSummary,
					IsCorrect:         allPassed,
					PointsEarned:      pointsEarned,
					PointsPossible:    points,
					PendingEvaluation: !allPassed,
					Explanation:       question.Explanation,
				})
				continue
			} else if question.QuestionType == "rating" {
				userDisplay = rawValue // numeric rating
			} else {
				userDisplay = fmt.Sprintf("%v", rawValue)
			}

			results = append(results, QuestionEvaluation{
				QuestionID:        question.ID,
				QuestionText:      question.QuestionText,
				QuestionType:      question.QuestionType,
				UserAnswer:        userDisplay,
				CorrectAnswer:     nil,
				IsCorrect:         false,
				PointsEarned:      0,
				PointsPossible:    points,
				PendingEvaluation: true,
				Explanation:       question.Explanation,
			})
			continue
		}

		// Auto-gradable types (single-choice, multiple-choice, text with correct answer)
		userValue := userAnswerWrapper["value"]

		// Build option ID to index map (1-based indices)
		optionIDToIndex := make(map[uint]int)
		for idx, opt := range question.Options {
			optionIDToIndex[opt.ID] = idx + 1
		}

		var userAnswerIndices string
		switch v := userValue.(type) {
		case float64:
			if idx, ok := optionIDToIndex[uint(v)]; ok {
				userAnswerIndices = fmt.Sprintf("%d", idx)
			}
		case []interface{}:
			var indices []string
			for _, optID := range v {
				if optIDFloat, ok := optID.(float64); ok {
					if idx, ok := optionIDToIndex[uint(optIDFloat)]; ok {
						indices = append(indices, fmt.Sprintf("%d", idx))
					}
				}
			}
			userAnswerIndices = strings.Join(indices, ",")
		case string:
			userAnswerIndices = v
		}

		correctAnswerIndices := question.CorrectAnswers
		isCorrect := s.evaluateAnswer(userAnswerIndices, correctAnswerIndices, question.QuestionType)

		pointsEarned := 0
		if isCorrect {
			pointsEarned = points
			totalScore += pointsEarned
			correctCount++
		}

		userAnswerDisplay := s.indicesToOptionText(userAnswerIndices, question.Options)
		correctAnswerDisplay := s.indicesToOptionText(correctAnswerIndices, question.Options)

		results = append(results, QuestionEvaluation{
			QuestionID:        question.ID,
			QuestionText:      question.QuestionText,
			QuestionType:      question.QuestionType,
			UserAnswer:        userAnswerDisplay,
			CorrectAnswer:     correctAnswerDisplay,
			IsCorrect:         isCorrect,
			PointsEarned:      pointsEarned,
			PointsPossible:    points,
			PendingEvaluation: false,
			Explanation:       question.Explanation,
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

// indicesToOptionText converts index strings like "1,3" to actual option text for display
func (s *quizEvaluationServiceImpl) indicesToOptionText(indices string, options []OptionFromAPI) interface{} {
	if indices == "" {
		return ""
	}

	// For text questions, return as-is
	if len(options) == 0 {
		return indices
	}

	parts := strings.Split(indices, ",")
	var texts []string

	for _, part := range parts {
		part = strings.TrimSpace(part)
		// Try to parse as index (1-based)
		var idx int
		if _, err := fmt.Sscanf(part, "%d", &idx); err == nil && idx > 0 && idx <= len(options) {
			texts = append(texts, options[idx-1].OptionText)
		} else {
			// Not a valid index, return as-is (for text answers)
			return indices
		}
	}

	if len(texts) == 1 {
		return texts[0]
	}
	return texts
}

func (s *quizEvaluationServiceImpl) evaluateAnswer(userAnswerIndices, correctAnswerIndices string, questionType string) bool {
	switch questionType {
	case "single-choice", "SINGLE_CHOICE":
		// Direct comparison for single choice
		return strings.TrimSpace(userAnswerIndices) == strings.TrimSpace(correctAnswerIndices)

	case "multiple-choice", "MULTIPLE_CHOICE":
		// Compare comma-separated indices (order doesn't matter)
		userParts := strings.Split(userAnswerIndices, ",")
		correctParts := strings.Split(correctAnswerIndices, ",")

		if len(userParts) != len(correctParts) {
			return false
		}

		// Convert to sets for comparison
		userSet := make(map[string]bool)
		for _, v := range userParts {
			userSet[strings.TrimSpace(v)] = true
		}

		for _, v := range correctParts {
			if !userSet[strings.TrimSpace(v)] {
				return false
			}
		}
		return true

	case "text", "TEXT":
		// Case-insensitive text comparison
		userLower := strings.ToLower(strings.TrimSpace(userAnswerIndices))
		correctLower := strings.ToLower(strings.TrimSpace(correctAnswerIndices))
		return userLower == correctLower

	default:
		// Default to string comparison
		return strings.TrimSpace(userAnswerIndices) == strings.TrimSpace(correctAnswerIndices)
	}
}

func (s *quizEvaluationServiceImpl) fetchSurveyWithQuestions(surveyID uint) (*SurveyDetailFromAPI, error) {
	// Get Survey Service URL
	surveyServiceURL := os.Getenv("SURVEY_SERVICE_URL")
	if surveyServiceURL == "" {
		surveyServiceURL = "http://localhost:5172" // Fixed: matches SurveyManagementService port
	}

	// Use internal endpoint for service-to-service communication
	url := fmt.Sprintf("%s/internal/api/v1/surveys/%d", surveyServiceURL, surveyID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	// Add internal API key header if configured
	if apiKey := os.Getenv("INTERNAL_API_KEY"); apiKey != "" {
		req.Header.Set("X-Internal-API-Key", apiKey)
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
		Success bool                `json:"success"`
		Data    SurveyDetailFromAPI `json:"data"`
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

// Piston language config
var pistonLanguageMap = map[string]struct{ name, version, ext string }{
	"python":     {"python", "3.10.0", "py"},
	"javascript": {"javascript", "18.15.0", "js"},
	"java":       {"java", "15.0.2", "Main.java"},
	"cpp":        {"c++", "10.2.0", "cpp"},
	"c":          {"c", "10.2.0", "c"},
	"go":         {"go", "1.16.2", "go"},
	"rust":       {"rust", "1.68.2", "rs"},
	"typescript": {"typescript", "5.0.3", "ts"},
}

type pistonResult struct {
	Stdout string
	Stderr string
	Code   int
}

func (s *quizEvaluationServiceImpl) executeCodeViaPiston(language, code, stdin string) pistonResult {
	pistonURL := os.Getenv("PISTON_URL")
	if pistonURL == "" {
		pistonURL = "http://piston:2000"
	}

	langConfig, ok := pistonLanguageMap[language]
	if !ok {
		return pistonResult{Stderr: "unsupported language: " + language}
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"language": langConfig.name,
		"version":  langConfig.version,
		"files": []map[string]string{
			{"name": "main." + langConfig.ext, "content": code},
		},
		"stdin":           stdin,
		"run_timeout":     3000,
		"compile_timeout": 3000,
	})

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(pistonURL+"/api/v2/execute", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return pistonResult{Stderr: "execution failed: " + err.Error()}
	}
	defer resp.Body.Close()

	var pistonResp struct {
		Run struct {
			Stdout string `json:"stdout"`
			Stderr string `json:"stderr"`
			Code   int    `json:"code"`
		} `json:"run"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&pistonResp); err != nil {
		return pistonResult{Stderr: "failed to parse execution result"}
	}

	return pistonResult{
		Stdout: pistonResp.Run.Stdout,
		Stderr: pistonResp.Run.Stderr,
		Code:   pistonResp.Run.Code,
	}
}
