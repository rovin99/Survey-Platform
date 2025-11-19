import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Award, Users, HelpCircle } from "lucide-react";
import type { AvailableSurvey } from "@/types/survey-taking";

interface SurveyCardProps {
  survey: AvailableSurvey;
  onStart: () => void;
}

export function SurveyCard({ survey, onStart }: SurveyCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg line-clamp-2">{survey.title}</CardTitle>
          {survey.category && (
            <Badge variant="secondary" className="shrink-0">
              {survey.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {survey.description}
        </p>

        <div className="space-y-2 mb-4 mt-auto">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2 shrink-0" />
            <span>{survey.estimatedTime || `${survey.questionCount} questions`}</span>
          </div>

          {survey.reward !== undefined && survey.reward > 0 && (
            <div className="flex items-center text-sm text-gray-600">
              <Award className="h-4 w-4 mr-2 shrink-0" />
              <span>{survey.reward} points</span>
            </div>
          )}

          {survey.conductor && (
            <div className="flex items-center text-sm text-gray-600">
              <Users className="h-4 w-4 mr-2 shrink-0" />
              <span className="truncate">{survey.conductor.name}</span>
            </div>
          )}

          <div className="flex items-center text-sm text-gray-600">
            <HelpCircle className="h-4 w-4 mr-2 shrink-0" />
            <span>{survey.questionCount} questions</span>
          </div>
        </div>

        <Button onClick={onStart} className="w-full">
          Start Survey
        </Button>
      </CardContent>
    </Card>
  );
}

