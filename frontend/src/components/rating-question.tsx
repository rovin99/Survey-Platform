"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterDropdown } from "./filter-dropdown";
import { QuestionComments } from "./question-comments";
import type { RatingQuestion, FilterType } from "@/types/survey-analysis";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface RatingQuestionProps {
  question: RatingQuestion;
}

export function RatingQuestionView({ question }: RatingQuestionProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("age");

  const distribution = question.ratings.map((count, index) => ({
    rating: (index + 1).toString(),
    count,
    percentage: (count / question.ratings.reduce((a, b) => a + b, 0)) * 100,
  }));

  return (
    <div className="grid grid-cols-3 gap-6">
      <Card className="col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{question.text}</CardTitle>
          <FilterDropdown onFilterChange={setActiveFilter} />
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <XAxis 
                  dataKey="rating" 
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Rating
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {data.rating}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Count
                              </span>
                              <span className="font-bold">
                                {data.count}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="currentColor"
                  radius={[4, 4, 0, 0]}
                  className="fill-primary"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <div>
        <QuestionComments comments={question.comments} />
      </div>
    </div>
  );
}
