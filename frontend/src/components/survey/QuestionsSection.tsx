import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionCard } from "./QuestionCard";
import type { Question } from "@/types/survey";

interface QuestionsSectionProps {
  questions: Question[];
  onAddQuestion: () => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => void;
  onDeleteQuestion: (questionId: string) => void;
  onAddOption: (questionId: string) => void;
  onDeleteOption: (questionId: string, optionId: string) => void;
  onMediaUpload: (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => void;
  onRemoveMedia: (questionId: string, mediaId: string) => void;
}

export function QuestionsSection({
  questions,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onAddOption,
  onDeleteOption,
  onMediaUpload,
  onRemoveMedia,
}: QuestionsSectionProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
            onDelete={() => onDeleteQuestion(question.id)}
            onAddOption={() => onAddOption(question.id)}
            onDeleteOption={(optionId) => onDeleteOption(question.id, optionId)}
            onMediaUpload={(e) => onMediaUpload(e, question.id)}
            onRemoveMedia={(mediaId) => onRemoveMedia(question.id, mediaId)}
          />
        ))}

        <Button variant="outline" onClick={onAddQuestion} className="w-full">
          + Add Question
        </Button>
      </CardContent>
    </>
  );
} 