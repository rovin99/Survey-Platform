export type FilterType = "age" | "geography" | "gender";

export interface DemographicBreakdown {
  age: { [key: string]: number };
  geography: { [key: string]: number };
  gender: { [key: string]: number };
}

export interface Option {
  text: string;
  count: number;
  percentage: number;
  demographicBreakdown: DemographicBreakdown;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface BaseQuestion {
  id: string;
  text: string;
  type: "single" | "multiple" | "text" | "rating";
  comments: Comment[];
}

export interface ChoiceQuestion extends BaseQuestion {
  type: "single" | "multiple";
  options: Option[];
}

export interface TextQuestion extends BaseQuestion {
  type: "text";
  responses: string[];
}

export interface RatingQuestion extends BaseQuestion {
  type: "rating";
  ratings: number[];
  demographicBreakdown: DemographicBreakdown;
}

export type Question = ChoiceQuestion | TextQuestion | RatingQuestion;
