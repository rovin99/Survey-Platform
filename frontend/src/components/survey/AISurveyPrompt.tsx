"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateSurveyFromPrompt, generateSurveyLocally } from '@/lib/aiSurveyGenerator';

interface Props {
  onGenerate: (survey: any) => void;
}

export function AISurveyPrompt({ onGenerate }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please describe the survey you want to create');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try AI generation first
      const survey = await generateSurveyFromPrompt(prompt);
      
      // Convert to survey format
      const formattedSurvey = {
        title: survey.title,
        description: survey.description,
        questions: survey.questions.map((q, index) => ({
          id: `q-${Date.now()}-${index}`,
          text: q.text,
          type: q.type,
          required: q.required,
          options: q.options?.map((opt, optIndex) => ({
            id: `opt-${Date.now()}-${index}-${optIndex}`,
            text: opt
          })) || [],
        }))
      };

      onGenerate(formattedSurvey);
    } catch (err) {
      console.error('AI generation failed, using fallback:', err);
      
      // Fallback to local generation
      try {
        const survey = generateSurveyLocally(prompt);
        const formattedSurvey = {
          title: survey.title,
          description: survey.description,
          questions: survey.questions.map((q, index) => ({
            id: `q-${Date.now()}-${index}`,
            text: q.text,
            type: q.type,
            required: q.required,
            options: q.options?.map((opt, optIndex) => ({
              id: `opt-${Date.now()}-${index}-${optIndex}`,
              text: opt
            })) || [],
          }))
        };
        onGenerate(formattedSurvey);
      } catch (fallbackErr) {
        setError('Failed to generate survey. Please try again or create manually.');
      }
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    "Customer satisfaction survey for a coffee shop",
    "Employee feedback survey for remote work",
    "Product feedback survey for a mobile app",
    "Event registration form with conditional questions"
  ];

  return (
    <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Survey Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Describe your survey in plain English
            </label>
            <Textarea
              placeholder="E.g., 'Create a customer satisfaction survey for a restaurant with questions about food quality, service, and atmosphere. Skip detailed questions if customer says they won't return.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <Button 
            onClick={handleGenerate} 
            disabled={loading || !prompt.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Survey...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Survey with AI
              </>
            )}
          </Button>

          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 mb-2">Quick examples (click to use):</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => setPrompt(example)}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

