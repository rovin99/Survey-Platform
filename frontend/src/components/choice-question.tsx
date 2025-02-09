"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterDropdown } from "./filter-dropdown";
import { QuestionComments } from "./question-comments";
import type { ChoiceQuestion, FilterType } from "@/types/survey-analysis";

interface ChoiceQuestionProps {
  question: ChoiceQuestion;
}

export function ChoiceQuestionView({ question }: ChoiceQuestionProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("age");
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  // Bright color palette
  const colors = ["#50FA7B", "#BD93F9", "#FFB86C", "#FF79C6", "#7DD4E6"];

  return (
    <div className="grid grid-cols-3 gap-6">
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{question.text}</CardTitle>
          <FilterDropdown onFilterChange={setActiveFilter} />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {question.options.map((option) => (
              <div
                key={option.text}
                className="space-y-1"
                onMouseEnter={() => setHoveredOption(option.text)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <div className="flex items-center justify-between text-sm">
                  <span>{option.text}</span>
                  <span>
                    {option.count} | {option.percentage}%
                  </span>
                </div>
                <div className="relative h-8">
                  <div className="absolute h-full bg-primary/20 rounded" style={{ width: `${option.percentage}%` }} />
                  {hoveredOption === option.text && (
                    <div 
                      className="absolute inset-0 flex transition-all duration-300 ease-in-out rounded"
                      style={{ width: `${option.percentage}%` }}
                    >
                      {Object.entries(option.demographicBreakdown[activeFilter]).map(([key, value], index) => (
                        <div
                          key={key}
                          className="h-full transition-all duration-300 ease-in-out"
                          style={{
                            width: `${value}%`,
                            backgroundColor: colors[index % colors.length],
                            opacity: 0,
                            animation: `fadeIn 300ms ease-in-out forwards`,
                            animationDelay: `0ms`,
                            borderRadius: index === 0 ? '0.375rem 0 0 0.375rem' : 
                                         index === Object.entries(option.demographicBreakdown[activeFilter]).length - 1 ? '0 0.375rem 0.375rem 0' : '0'
                          }}
                        />
                      ))}
                      <style jsx>{`
                        @keyframes fadeIn {
                          from { opacity: 0; }
                          to { opacity: 1; }
                        }
                      `}</style>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div>
        <QuestionComments comments={question.comments} />
      </div>
    </div>
  );
}
