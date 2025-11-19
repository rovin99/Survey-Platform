import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Star, Check } from "lucide-react";
import type { SurveyQuestion } from "@/types/survey-taking";
import { cn } from "@/lib/utils";

interface QuestionRendererProps {
  question: SurveyQuestion;
  value: any;
  onChange: (value: any) => void;
}

export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  // Single Choice Question - Clean card-based selection
  if (question.questionType === "single-choice") {
    return (
      <div className="space-y-2">
        {question.options?.map((option, index) => {
          const isSelected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                "hover:shadow-md hover:border-blue-300",
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  )}
                >
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className={cn(
                  "font-medium",
                  isSelected ? "text-blue-900" : "text-gray-700"
                )}>
                  {option.optionText}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Multiple Choice Question - Clean checkbox cards
  if (question.questionType === "multiple-choice") {
    const selectedOptions = Array.isArray(value) ? value : [];

    return (
      <div className="space-y-2">
        {question.options?.map((option) => {
          const isSelected = selectedOptions.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (isSelected) {
                  onChange(selectedOptions.filter((id: number) => id !== option.id));
                } else {
                  onChange([...selectedOptions, option.id]);
                }
              }}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                "hover:shadow-md hover:border-blue-300",
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 bg-white"
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={cn(
                  "font-medium",
                  isSelected ? "text-blue-900" : "text-gray-700"
                )}>
                  {option.optionText}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Text Question - Clean minimal textarea
  if (question.questionType === "text") {
    return (
      <div className="space-y-2">
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={6}
          className="resize-none border-2 focus:border-blue-500 transition-colors"
        />
        <p className="text-xs text-gray-500 text-right">
          {value?.length || 0} characters
        </p>
      </div>
    );
  }

  // Rating Question - Modern star rating with hover effects
  if (question.questionType === "rating") {
    const currentRating = value || 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              onMouseEnter={(e) => {
                // Add hover effect
                const stars = e.currentTarget.parentElement?.querySelectorAll('button');
                stars?.forEach((star, idx) => {
                  if (idx < rating) {
                    star.querySelector('svg')?.classList.add('scale-110');
                  }
                });
              }}
              onMouseLeave={(e) => {
                // Remove hover effect
                const stars = e.currentTarget.parentElement?.querySelectorAll('button');
                stars?.forEach((star) => {
                  star.querySelector('svg')?.classList.remove('scale-110');
                });
              }}
              className={cn(
                "transition-transform duration-200 hover:scale-110",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-2"
              )}
            >
              <Star
                className={cn(
                  "w-10 h-10 transition-all duration-200",
                  currentRating >= rating
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                )}
              />
            </button>
          ))}
        </div>

        {/* Rating labels */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Poor</span>
          <span className={cn(
            "font-semibold transition-opacity",
            currentRating > 0 ? "opacity-100" : "opacity-0"
          )}>
            {currentRating > 0 && (
              <span className="text-blue-600">
                {currentRating === 1 && "Poor"}
                {currentRating === 2 && "Fair"}
                {currentRating === 3 && "Good"}
                {currentRating === 4 && "Very Good"}
                {currentRating === 5 && "Excellent"}
              </span>
            )}
          </span>
          <span className="text-gray-500">Excellent</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-red-50 border-2 border-red-200 rounded-lg text-center">
      <p className="text-red-600 font-medium">
        Unknown question type: {question.questionType}
      </p>
    </div>
  );
}

