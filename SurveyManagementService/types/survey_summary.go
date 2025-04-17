package types


// SurveySummary represents the demographic and timeline data for a survey
type SurveySummary struct {
	TotalResponses     int                     `json:"total_responses"`
	AverageTimeSeconds float64                 `json:"average_time_seconds"`
	TimelineData       []TimelinePoint         `json:"timeline_data"`
	Demographics       SurveyDemographics      `json:"demographics"`
}

// TimelinePoint represents a point in the response timeline
type TimelinePoint struct {
	Date      string    `json:"date"`
	Responses int       `json:"responses"`
}

// SurveyDemographics contains demographic breakdowns
type SurveyDemographics struct {
	Gender     []ResponseSummary `json:"gender"`
	Geography  []ResponseSummary `json:"geography"`
	AgeGroups  []ResponseSummary `json:"age_groups"`
}

// DetailedResults represents detailed question-by-question results
type DetailedResults struct {
	TotalResponses    int                    `json:"total_responses"`
	QuestionResponses []QuestionResponseStats `json:"question_responses"`
}
