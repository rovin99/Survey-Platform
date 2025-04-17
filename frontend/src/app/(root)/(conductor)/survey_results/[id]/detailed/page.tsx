'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { surveyService } from '@/services/survey-service';
import type { DetailedResults, QuestionResponseStats } from '@/types/survey-response';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronRight, Filter } from 'lucide-react';

export default function DetailedResults() {
  const params = useParams();
  const surveyId = params.id;
  const [results, setResults] = useState<DetailedResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ [key: string | number]: string }>({});
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      try {
        if (!surveyId) {
          setError('Survey ID is required');
          return;
        }

        const data = await surveyService.getDetailedResults(parseInt(surveyId as string, 10));
        setResults(data);
      } catch (error) {
        setError('Failed to fetch detailed results');
        console.error('Error fetching detailed results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [surveyId]);

  const handleNoteChange = (questionId: string | number, note: string) => {
    setNotes(prev => ({
      ...prev,
      [questionId]: note
    }));
  };

  const filteredQuestions = results?.question_responses.filter(q => 
    q.question_text.toLowerCase().includes(filterText.toLowerCase())
  );

  const renderQuestionStats = (question: QuestionResponseStats) => {
    const totalResponses = question.responses.reduce((sum, r) => sum + r.count, 0);
    
    return (
      <Card key={question.question_id} className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {question.question_text}
            <span className="ml-2 text-xs text-gray-500">
              ({question.question_type})
            </span>
          </CardTitle>
          <div className="text-xs text-gray-500">
            {totalResponses} responses
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={question.responses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="response_text" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            {question.responses.map(response => (
              <div key={response.response_text} className="flex items-center justify-between mb-2">
                <span className="text-sm">{response.response_text}</span>
                <div className="flex items-center gap-2">
                  <Progress value={response.percentage} className="w-32" />
                  <span className="text-sm w-16 text-right">{response.count} ({Math.round(response.percentage)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  if (!results) {
    return <div className="flex justify-center items-center min-h-screen">No results found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumb and Actions */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Surveys</span>
          <ChevronRight className="h-4 w-4" />
          <span>Survey Results</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium">Detailed Analysis</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Share</Button>
          <Button variant="outline">Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left side: Questions */}
        <div className="col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Filter questions..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-10"
              />
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <span className="text-sm text-gray-500">
              {filteredQuestions?.length || 0} questions
            </span>
          </div>
          
          <div className="space-y-6">
            {filteredQuestions?.map(renderQuestionStats)}
          </div>
        </div>

        {/* Right side: Notes */}
        <div className="col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Analysis Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* General Notes */}
                <div>
                  <h4 className="font-medium mb-2 text-sm">General Notes</h4>
                  <Textarea
                    placeholder="Add your general survey analysis notes here..."
                    value={notes['general'] || ''}
                    onChange={(e) => handleNoteChange('general', e.target.value)}
                    className="min-h-[150px]"
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 text-sm">Question-specific Notes</h4>
                  <div className="space-y-4">
                    {filteredQuestions?.map(question => (
                      <div key={question.question_id}>
                        <h4 className="font-medium mb-2 text-sm">{question.question_text}</h4>
                        <Textarea
                          placeholder="Add your notes here..."
                          value={notes[question.question_id] || ''}
                          onChange={(e) => handleNoteChange(question.question_id, e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
