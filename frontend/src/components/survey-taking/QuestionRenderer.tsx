import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import type { SurveyQuestion } from "@/types/survey-taking";

interface QuestionRendererProps {
  question: SurveyQuestion;
  value: any;
  onChange: (value: any) => void;
}

export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  // Single Choice Question
  if (question.questionType === "single-choice") {
    return (
      <RadioGroup
        value={value ? String(value) : undefined}
        onValueChange={(val) => onChange(parseInt(val))}
      >
        <div className="space-y-3">
          {question.options?.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <RadioGroupItem value={String(option.id)} id={`option-${option.id}`} />
              <Label
                htmlFor={`option-${option.id}`}
                className="font-normal cursor-pointer"
              >
                {option.optionText}
              </Label>
            </div>
          ))}
        </div>
      </RadioGroup>
    );
  }

  // Multiple Choice Question
  if (question.questionType === "multiple-choice") {
    const selectedOptions = Array.isArray(value) ? value : [];
    
    return (
      <div className="space-y-3">
        {question.options?.map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <Checkbox
              id={`option-${option.id}`}
              checked={selectedOptions.includes(option.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selectedOptions, option.id]);
                } else {
                  onChange(selectedOptions.filter((id: number) => id !== option.id));
                }
              }}
            />
            <Label
              htmlFor={`option-${option.id}`}
              className="font-normal cursor-pointer"
            >
              {option.optionText}
            </Label>
          </div>
        ))}
      </div>
    );
  }

  // Text Question
  if (question.questionType === "text") {
    return (
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer here..."
        rows={5}
        className="resize-none"
      />
    );
  }

  // Rating Question
  if (question.questionType === "rating") {
    const maxRating = 5;
    const currentRating = value || 0;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <Button
              key={rating}
              type="button"
              variant={currentRating >= rating ? "default" : "outline"}
              size="lg"
              onClick={() => onChange(rating)}
              className="w-12 h-12 p-0"
            >
              <Star
                className="h-5 w-5"
                fill={currentRating >= rating ? "currentColor" : "none"}
              />
            </Button>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Poor</span>
          <span>Excellent</span>
        </div>
      </div>
    );
  }

  return (
    <div className="text-red-500">
      Unknown question type: {question.questionType}
    </div>
  );
}

