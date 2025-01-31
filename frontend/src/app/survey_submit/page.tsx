"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2 } from "lucide-react";

// Define schema using Zod for validation
const surveySchema = z.object({
  satisfaction: z.string().min(1, "This question is required"),
  recommend: z.string().min(1, "This question is required"),
  feedback: z.string().max(500, "Feedback cannot exceed 500 characters").optional(),
});

// Sample question data (must be fetched from the backend)
const surveyQuestions = [
  {
    id: "satisfaction",
    question: "How satisfied are you with our service?",
    options: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
    required: true,
  },
  {
    id: "recommend",
    question: "Would you recommend us to others?",
    options: ["Yes", "No"],
    required: true,
  },
  {
    id: "feedback",
    question: "Any additional feedback?",
    options: [],
    maxLength: 500,
  },
];

export default function Survey() {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = () => setCurrentIndex(0);
  const handleReturn = () => setCurrentIndex(-1);
  
   // Survey metadata
   const surveyTitle = "Customer Satisfaction Survey";
   const surveyDescription = "Thank you for taking the time to complete our survey. Your feedback helps us improve our services. Please answer the questions honestly.";
   const surveyConductedBy = "XYZ Company";

  // Track progress using local storage
  useEffect(() => {
    const savedData = localStorage.getItem("surveyProgress");
    if (savedData) {
      const { index, responses } = JSON.parse(savedData);
      setCurrentIndex(index);
      setResponses(responses);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("surveyProgress", JSON.stringify({ index: currentIndex, responses }));
  }, [currentIndex, responses]);

  const currentQuestion = surveyQuestions[currentIndex];

  // Go to previous question
  const handlePrevious = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setErrors((prevErrors) => ({ ...prevErrors, [currentQuestion.id]: "" }));
    
    // Allow navigation back to details card when on first question
    setCurrentIndex((prev) => {
      if (prev === 0) return -1;  // Special case for first question
      return Math.max(0, prev - 1);
    });
  };

  // Go to next question
  const handleNext = () => {
    const questionId = currentQuestion.id;
    const response = responses[questionId];

    if (currentQuestion.required && !response) {
      setErrors((prevErrors) => ({ ...prevErrors, [questionId]: "This question is required" }));
      return;
    }

    setErrors((prevErrors) => ({ ...prevErrors, [questionId]: "" }));
    setCurrentIndex((prev) => Math.min(surveyQuestions.length - 1, prev + 1));
  };

  // Submit the survey
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = surveySchema.safeParse(responses);

    if (!parsed.success) {
      const newErrors = parsed.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(Object.entries(newErrors).map(([key, value]) => [key, value?.[0] || ""]))
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API request
      localStorage.removeItem("surveyProgress");
      setHasSubmitted(true);
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Thank you!</h1>
        <p className="text-muted-foreground">Your responses have been submitted successfully.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
        
        {/* Survey Title (Always Visible) */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{surveyTitle}</h1>
        </div>
        {currentIndex == -1 ? ( 
          <Card className="mb-6 max-w-md mx-auto border border-gray-200 shadow-md bg-white dark:bg-gray-900 dark:border-gray-700 p-4">
          <CardHeader className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {surveyDescription}
            </p>
          </CardHeader>
          <CardContent className="p-4 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium">Conducted by:</p>
            <p>{surveyConductedBy}</p>
          </CardContent>
          <CardFooter className="p-4 flex justify-between">
            <Button
              variant="outline"
              onClick={handleReturn}
              className="px-4 py-2 rounded-lg border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Return
            </Button>
            <Button
              variant="default"
              onClick={handleStart}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Start
            </Button>
          </CardFooter>
        </Card>
        ) : 
        (<Card className="w-full max-w-lg shadow-lg transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg">
              {currentQuestion.question}
              {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {currentQuestion.options.length > 0 ? (
              <div className="flex flex-col gap-2">
                {currentQuestion.options.map((option, idx) => (
                  <Button
                    key={option}
                    type="button"
                    variant={responses[currentQuestion.id] === option ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setResponses((prev) => ({ ...prev, [currentQuestion.id]: option }))}
                  >
                    <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <textarea
                  name={currentQuestion.id}
                  className="w-full p-2 border rounded-md min-h-[100px]"
                  placeholder="Type your response..."
                  value={responses[currentQuestion.id] || ""}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                  maxLength={currentQuestion.maxLength}
                  autoFocus
                />
                <div className="text-sm text-muted-foreground text-right">
                  {responses[currentQuestion.id]?.length || 0}/{currentQuestion.maxLength}
                </div>
              </div>
            )}
            {errors[currentQuestion.id] && <p className="text-sm text-destructive mt-2">{errors[currentQuestion.id]}</p>}
          </CardContent>

          <CardFooter className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
              <Button
                type="button"
                variant={currentIndex === surveyQuestions.length - 1 ? "default" : "outline"}
                onClick={currentIndex === surveyQuestions.length - 1 ? handleSubmit : handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentIndex === surveyQuestions.length - 1 ? (isSubmitting ? "Submitting..." : "Submit") : "Next"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Question {currentIndex + 1} of {surveyQuestions.length}</p>
          </CardFooter>
        </Card>
        )}

        <Progress value={(currentIndex + 1) / surveyQuestions.length * 100} className="w-full max-w-lg" />
      </div>
    </form>
  );
}
