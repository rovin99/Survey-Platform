export interface SurveyMetrics {
  prizePool: {
    current: number;
    total: number;
  };
  progress: number;
  responses: number;
  averageTime: string;
}

export interface DistributionData {
  gender: Array<{ name: string; value: number }>;
  geography: Array<{ name: string; value: number }>;
  age: Array<{ range: string; count: number }>;
}

export interface TimeSeriesData {
  timestamp: string;
  responses: number;
}
