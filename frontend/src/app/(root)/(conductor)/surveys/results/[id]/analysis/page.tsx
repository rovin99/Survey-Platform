"use client";

import Link from "next/link";
import { ChevronRight, Share, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceQuestionView } from "@/components/choice-question";
import { TextQuestionView } from "@/components/text-question";
import { RatingQuestionView } from "@/components/rating-question";
import type { Question } from "@/types/survey-analysis";

// Sample data
const questions: Question[] = [
  {
    id: "1",
    text: "How satisfied are you with our product?",
    type: "single",
    options: [
      {
        text: "Very Satisfied",
        count: 150,
        percentage: 45,
        demographicBreakdown: {
          age: { "18-24": 30, "25-34": 40, "35+": 30 },
          geography: { NA: 40, EU: 35, Asia: 25 },
          gender: { Male: 55, Female: 40, Other: 5 },
        },
      },
      // ... more options
    ],
    comments: [
      {
        id: "c1",
        text: "High satisfaction among young users",
        author: "John Doe",
        timestamp: "2h ago",
      },
    ],
  },
  {
    id: "2",
    text: "What features would you like to see?",
    type: "text",
    responses: [
      "Better mobile support",
      "Dark mode",
      "More integrations",
      // ... more responses
    ],
    comments: [],
  },
  {
    id: "3",
    text: "Rate our customer service (1-5)",
    type: "rating",
    ratings: [10, 20, 45, 80, 30],
    demographicBreakdown: {
      age: { "18-24": 30, "25-34": 40, "35+": 30 },
      geography: { NA: 40, EU: 35, Asia: 25 },
      gender: { Male: 55, Female: 40, Other: 5 },
    },
    comments: [],
  },
];

export default function SurveyAnalysis() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/surveys" className="hover:text-foreground">
            Surveys
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/surveys/1" className="hover:text-foreground">
            Customer Satisfaction Q1
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Analysis</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {questions.map((question) => {
          switch (question.type) {
            case "single":
            case "multiple":
              return <ChoiceQuestionView key={question.id} question={question} />;
            case "text":
              return <TextQuestionView key={question.id} question={question} />;
            case "rating":
              return <RatingQuestionView key={question.id} question={question} />;
          }
        })}
      </div>
    </div>
  );
}
