export interface ResponseSummary {
  response_text: string;
  count: number;
  percentage: number;
}

export interface QuestionResponseStats {
  question_id: number;
  question_text: string;
  question_type: string;
  responses: ResponseSummary[];
}

export interface TimelinePoint {
  date: string;
  responses: number;
}

export interface SurveyDemographics {
  gender: ResponseSummary[];
  geography: ResponseSummary[];
  age_groups: ResponseSummary[];
}

export interface SurveySummary {
  total_responses: number;
  average_time_seconds: number;
  timeline_data: TimelinePoint[];
  demographics: SurveyDemographics;
}

export interface DetailedResults {
  total_responses: number;
  question_responses: QuestionResponseStats[];
}

// Kept for backward compatibility
export interface SurveyResults {
  total_responses: number;
  average_time_seconds: number;
  question_responses: QuestionResponseStats[];
}
