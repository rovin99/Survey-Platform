package types

// SurveyResults represents the aggregated results of a survey
type SurveyResults struct {
	TotalResponses     int                     `json:"total_responses"`
	AverageTimeSeconds float64                 `json:"average_time_seconds"`
	QuestionResponses  []QuestionResponseStats `json:"question_responses"`
}

// QuestionResponseStats represents statistics for a single question
type QuestionResponseStats struct {
	QuestionID   uint              `json:"question_id"`
	QuestionText string            `json:"question_text"`
	QuestionType string            `json:"question_type"`
	Responses    []ResponseSummary `json:"responses"`
}

// ResponseSummary represents summary of responses for a question
type ResponseSummary struct {
	ResponseText string  `json:"response_text"`
	Count        int     `json:"count"`
	Percentage   float64 `json:"percentage"`
}
