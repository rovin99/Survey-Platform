import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Loader2, FileImage, X } from "lucide-react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import type { Question } from "@/types/survey";
import { QUESTION_TYPES } from "@/constants/survey";

interface QuestionCardProps {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onAddOption: () => void;
  onDeleteOption: (optionId: string) => void;
  onMediaUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMedia: (mediaId: string) => void;
}

export function QuestionCard({
  question,
  onUpdate,
  onDelete,
  onAddOption,
  onDeleteOption,
  onMediaUpload,
  onRemoveMedia,
}: QuestionCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Question Header */}
      <div className="flex justify-between items-center">
        <Select 
          defaultValue={question.type}
          onValueChange={(value: Question['type']) => onUpdate({ type: value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Question type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={QUESTION_TYPES.MULTIPLE_CHOICE}>
              Multiple Choice
            </SelectItem>
            <SelectItem value={QUESTION_TYPES.SINGLE_CHOICE}>
              Single Choice
            </SelectItem>
            <SelectItem value={QUESTION_TYPES.TEXT}>Text Input</SelectItem>
            <SelectItem value={QUESTION_TYPES.RATING}>Rating Scale</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`mandatory-${question.id}`}
              checked={question.mandatory}
              onCheckedChange={(checked: CheckedState) => {
                onUpdate({ mandatory: checked === true });
              }}
            />
            <label htmlFor={`mandatory-${question.id}`} className="text-sm font-medium">
              Required
            </label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Question Text */}
      <div className="relative">
        <Input
          value={question.text}
          placeholder="Enter question text"
          className={question.mandatory ? "pr-8" : ""}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
        {question.mandatory && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-lg">*</span>
        )}
      </div>

      {/* Correct Answers */}
      <div className="space-y-2 mt-4">
        <label htmlFor={`correct-answers-${question.id}`} className="text-sm font-medium flex items-center gap-2">
          Correct Answer(s)
          <span className="text-xs text-muted-foreground">
            {question.type === QUESTION_TYPES.MULTIPLE_CHOICE 
              ? "(Comma-separated option numbers, e.g. 1,3,4)" 
              : question.type === QUESTION_TYPES.SINGLE_CHOICE 
              ? "(Enter the correct option number, e.g. 2)" 
              : "(Enter the correct answer text)"}
          </span>
        </label>
        <Input
          id={`correct-answers-${question.id}`}
          value={question.correctAnswers || ""}
          placeholder="Enter correct answer(s)"
          onChange={(e) => onUpdate({ correctAnswers: e.target.value })}
        />
      </div>

      {/* Media Upload Section */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Media Attachments</div>
          <label 
            htmlFor={`media-upload-${question.id}`}
            className="flex items-center gap-1 text-sm cursor-pointer text-primary hover:underline"
          >
            <Upload className="h-4 w-4" />
            Add Media
          </label>
          <input
            id={`media-upload-${question.id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onMediaUpload}
          />
        </div>
        
        {/* Display uploaded media */}
        {question.mediaFiles && question.mediaFiles.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {question.mediaFiles.map((media) => (
              <div 
                key={media.id} 
                className="relative border rounded-md overflow-hidden group"
              >
                {media.status === 'UPLOADING' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
                
                {media.status === 'ERROR' && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <div className="text-white text-sm">Upload Failed</div>
                  </div>
                )}
                
                {media.type === 'IMAGE' ? (
                  <img 
                    src={media.url} 
                    alt="Question media" 
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                    <FileImage className="h-10 w-10 text-gray-400" />
                  </div>
                )}
                
                <button
                  onClick={() => onRemoveMedia(media.id)}
                  className="absolute top-1 right-1 bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove media"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Options for non-text questions */}
      {question.type !== QUESTION_TYPES.TEXT && (
        <div className="space-y-2 ml-4">
          {question.options.map((option) => (
            <div key={option.id} className="flex gap-2 items-center">
              <Input
                value={option.text}
                placeholder="Option text"
                className="flex-1"
                onChange={(e) => {
                  const updatedOptions = question.options.map((opt) =>
                    opt.id === option.id ? { ...opt, text: e.target.value } : opt
                  );
                  onUpdate({ options: updatedOptions });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteOption(option.id)}
                className="text-destructive"
              >
                ×
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddOption}
            className="mt-2"
          >
            + Add Option
          </Button>
        </div>
      )}
    </div>
  );
} 