import { useState, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Star, Check, Upload, ImageIcon, X, Loader2 } from "lucide-react";
import type { SurveyQuestion } from "@/types/survey-taking";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./CodeEditor";
import type { TestCase } from "@/services/codeExecution.service";
import { surveyTakingService } from "@/services/surveyTaking.service";
import { toast } from "sonner";

interface QuestionRendererProps {
  question: SurveyQuestion;
  value: any;
  onChange: (value: any) => void;
  sessionId?: number;
  // Single justification (single-choice questions)
  reason?: string;
  onReasonChange?: (reason: string) => void;
  // Per-option justifications (multiple-choice questions), keyed by option id
  optionReasons?: Record<number, string>;
  onOptionReasonChange?: (optionId: number, reason: string) => void;
}

// Participant-authored justification field, shown under choice options (anti-cheating)
function JustificationField({
  question,
  reason,
  onReasonChange,
}: {
  question: SurveyQuestion;
  reason?: string;
  onReasonChange?: (reason: string) => void;
}) {
  if (!question.requiresJustification) return null;
  return (
    <div className="mt-4 space-y-2 p-4 rounded-lg border-2 border-amber-200 bg-amber-50/50">
      <Label className="text-sm font-medium text-amber-900 flex items-center gap-1">
        Why did you choose this answer?
        {question.justificationRequired && <span className="text-red-500">*</span>}
      </Label>
      <Textarea
        value={reason || ""}
        onChange={(e) => onReasonChange?.(e.target.value)}
        placeholder="Briefly explain your reasoning..."
        rows={3}
        className="resize-none bg-white border-2 focus:border-amber-500 transition-colors"
      />
    </div>
  );
}

export function QuestionRenderer({ question, value, onChange, sessionId, reason, onReasonChange, optionReasons, onOptionReasonChange }: QuestionRendererProps) {
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
        <JustificationField question={question} reason={reason} onReasonChange={onReasonChange} />
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
            <div key={option.id} className="space-y-2">
              <button
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

              {/* Per-option justification — shown under each SELECTED option (anti-cheating) */}
              {isSelected && question.requiresJustification && (
                <div className="ml-8 p-3 rounded-lg border-2 border-amber-200 bg-amber-50/50 space-y-1">
                  <Label className="text-xs font-medium text-amber-900 flex items-center gap-1">
                    Why did you choose &quot;{option.optionText}&quot;?
                    {question.justificationRequired && <span className="text-red-500">*</span>}
                  </Label>
                  <Textarea
                    value={optionReasons?.[option.id] || ""}
                    onChange={(e) => onOptionReasonChange?.(option.id, e.target.value)}
                    placeholder="Briefly explain your reasoning for this option..."
                    rows={2}
                    className="resize-none bg-white border-2 focus:border-amber-500 transition-colors"
                  />
                </div>
              )}
            </div>
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
              onClick={() => onChange(currentRating === rating ? 0 : rating)}
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

  // Code Question - Code editor with execution
  if (question.questionType === "code") {
    // Parse code settings from question metadata
    let codeSettings: {
      defaultLanguage?: string;
      allowedLanguages?: string[];
      testCases?: TestCase[];
      starterCode?: Record<string, string>;
    } = {};

    try {
      if (question.codeSettings) {
        codeSettings = typeof question.codeSettings === 'string'
          ? JSON.parse(question.codeSettings)
          : question.codeSettings;
      }
    } catch (e) {
      console.error('Error parsing code settings:', e);
    }

    return (
      <CodeEditor
        questionId={question.id}
        defaultLanguage={codeSettings.defaultLanguage || 'python'}
        allowedLanguages={codeSettings.allowedLanguages}
        testCases={codeSettings.testCases || []}
        starterCode={codeSettings.starterCode}
        value={value}
        onChange={onChange}
      />
    );
  }

  // Image Upload Question
  if (question.questionType === "image-upload") {
    return (
      <ImageUploadRenderer
        value={value}
        onChange={onChange}
        sessionId={sessionId}
      />
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

function ImageUploadRenderer({
  value,
  onChange,
  sessionId,
}: {
  value: any;
  onChange: (value: any) => void;
  sessionId?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!sessionId) {
      toast.error("Session not available. Please try again.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed (JPEG, PNG, GIF, WebP).");
      return;
    }

    try {
      setUploading(true);
      const result = await surveyTakingService.uploadImage(sessionId, file);
      onChange(result.fileUrl);
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload failed:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const imageUrl = value
    ? value.startsWith("http")
      ? value
      : `${process.env.NEXT_PUBLIC_PARTICIPANTS_SERVICE_URL || "http://localhost:5173"}${value}`
    : null;

  return (
    <div className="space-y-4">
      {imageUrl ? (
        <div className="relative group">
          <div className="border-2 border-green-200 rounded-lg overflow-hidden bg-gray-50">
            <img
              src={imageUrl}
              alt="Uploaded answer"
              className="max-h-80 w-auto mx-auto object-contain"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              Image uploaded
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange(undefined)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full p-12 border-2 border-dashed rounded-lg transition-all duration-200",
            "flex flex-col items-center justify-center gap-3",
            uploading
              ? "border-blue-300 bg-blue-50 cursor-wait"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <span className="text-blue-600 font-medium">Uploading...</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-12 h-12 text-gray-400" />
              <span className="text-gray-600 font-medium">
                Click to upload an image
              </span>
              <span className="text-sm text-gray-400">
                JPEG, PNG, GIF, or WebP (max 5MB)
              </span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

