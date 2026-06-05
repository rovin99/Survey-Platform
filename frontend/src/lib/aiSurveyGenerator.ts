// AI Survey Generator - Simple OpenAI Integration
// Just pass a prompt, get back complete survey

interface AIGeneratedSurvey {
  title: string;
  description: string;
  questions: AIGeneratedQuestion[];
}

interface AIGeneratedQuestion {
  text: string;
  type: 'multiple-choice' | 'text' | 'rating';
  required: boolean;
  options?: string[];
}

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

export async function generateSurveyFromPrompt(prompt: string): Promise<AIGeneratedSurvey> {
  const systemPrompt = `You are a survey design expert. Generate a complete survey based on the user's prompt.

Return JSON in this EXACT format:
{
  "title": "Survey Title",
  "description": "Brief description",
  "questions": [
    {
      "text": "Question text",
      "type": "multiple-choice" or "text" or "rating",
      "required": true or false,
      "options": ["Option 1", "Option 2"] (only for multiple-choice)
    }
  ]
}

Rules:
- Create 5-10 relevant questions
- Make questions clear and concise
- Use a mix of question types where appropriate`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheaper, faster
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const surveyData = JSON.parse(data.choices[0].message.content);

    return surveyData;
  } catch (error) {
    console.error('AI generation failed:', error);
    throw new Error('Failed to generate survey. Please try again.');
  }
}

// Fallback: Free local generation (no AI)
export function generateSurveyLocally(prompt: string): AIGeneratedSurvey {
  // Simple template-based generation if no API key
  const keywords = prompt.toLowerCase();

  const templates: Record<string, AIGeneratedSurvey> = {
    'customer satisfaction': {
      title: 'Customer Satisfaction Survey',
      description: 'Help us improve our service',
      questions: [
        {
          text: 'Have you used our service before?',
          type: 'multiple-choice',
          required: true,
          options: ['Yes', 'No'],
        },
        {
          text: 'How satisfied are you with our service?',
          type: 'multiple-choice',
          required: true,
          options: ['Very Satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very Dissatisfied'],
        },
        {
          text: 'What did you like most?',
          type: 'text',
          required: false
        },
        {
          text: 'How can we improve?',
          type: 'text',
          required: true
        }
      ]
    }
  };

  // Return template or default
  for (const [key, template] of Object.entries(templates)) {
    if (keywords.includes(key)) {
      return template;
    }
  }

  // Default generic survey
  return {
    title: 'Survey',
    description: prompt,
    questions: [
      {
        text: 'What is your feedback?',
        type: 'text',
        required: true
      }
    ]
  };
}
