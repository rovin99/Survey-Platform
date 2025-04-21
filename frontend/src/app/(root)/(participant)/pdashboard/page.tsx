"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import { Survey, surveyService } from "@/services/surveyService";

// Sample data for completed surveys - this would come from an API in production
const completedSurveys = [
  {
    id: "3",
    title: "Website Redesign Feedback",
    completedDate: "Feb 1, 2024",
    status: "Completed",
  },
  {
    id: "4",
    title: "Product Feature Survey",
    completedDate: "Jan 15, 2024",
    status: "Processing",
  },
];

export default function ParticipantDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [availableSurveys, setAvailableSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchSurveys = async () => {
      try {
        const surveys = await surveyService.getAvailableSurveys();
        console.log('Surveys fetched:', JSON.stringify(surveys, null, 2));
        setAvailableSurveys(surveys);
      } catch (error) {
        console.error('Error fetching surveys:', error);
        // Fallback to hardcoded survey data when API fails
        setAvailableSurveys([
          {
            id: 4,
            conductor_id: 1,
            title: "Student Demographics Survey",
            description: "A survey to understand student demographics at IITGN",
            is_self_recruitment: true,
            status: "PUBLISHED",
            questions: [
              {
                id: 5,
                survey_id: 4,
                question_text: "What is your gender?",
                question_type: "MULTIPLE_CHOICE",
                correct_answers: "Male,Female,Other",
                branching_logic: "",
                mandatory: true,
                created_at: "",
                updated_at: ""
              },
              {
                id: 6,
                survey_id: 4,
                question_text: "What is your age group?",
                question_type: "MULTIPLE_CHOICE",
                correct_answers: "18-20,21-23,24-26,27+",
                branching_logic: "",
                mandatory: true,
                created_at: "",
                updated_at: ""
              },
              {
                id: 7,
                survey_id: 4,
                question_text: "Which state are you from?",
                question_type: "MULTIPLE_CHOICE",
                correct_answers: "Gujarat,Maharashtra,Delhi,Tamil Nadu,Karnataka",
                branching_logic: "",
                mandatory: true,
                created_at: "",
                updated_at: ""
              }
            ],
            created_at: "",
            updated_at: ""
          }
        ]);
        setErrorMessage("Could not connect to survey service. Using local data instead.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveys();
  }, [user, router]);

  const handleStartSurvey = (surveyId: string) => {
    router.push(`/survey_submit?id=${surveyId}`);
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">Loading surveys...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            {errorMessage}
          </div>
        )}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Participant Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Welcome back!</p>
          </div>
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Available Surveys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableSurveys.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Surveys Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedSurveys.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Active Survey</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {availableSurveys.find(s => s.status === "PUBLISHED")?.title || "None"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="space-y-4">
          <TabsList>
            <TabsTrigger value="available">Available Surveys</TabsTrigger>
            <TabsTrigger value="completed">Completed Surveys</TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableSurveys.map((survey) => (
                <Card key={`available-${survey.id}`}>
                  <CardHeader>
                    <CardTitle className="text-xl">{survey.title}</CardTitle>
                    <Badge variant={survey.status === "PUBLISHED" ? "default" : "secondary"}>
                      {survey.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-2" />
                        Questions: {Array.isArray(survey.questions) ? survey.questions.length : 0}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {survey.description}
                      </div>
                      {survey.status === "PUBLISHED" && (
                        <Button 
                          className="w-full" 
                          onClick={() => handleStartSurvey(survey.id.toString())}
                        >
                          Start Survey
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {availableSurveys.length === 0 && (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  No surveys available at the moment.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {completedSurveys.map((survey) => (
                <Card key={`completed-${survey.id}`}>
                  <CardHeader>
                    <CardTitle className="text-xl">{survey.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 mr-2" />
                        Completed: {survey.completedDate}
                      </div>
                      <Badge variant="secondary">
                        {survey.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {completedSurveys.length === 0 && (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  No completed surveys yet.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
