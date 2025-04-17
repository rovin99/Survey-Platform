'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { surveyService } from '@/services/survey-service';
import type { SurveySummary } from '@/types/survey-response';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SurveyResults() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('id');
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        if (!surveyId) {
          setError('Survey ID is required');
          return;
        }

        const data = await surveyService.getSurveySummary(parseInt(surveyId, 10));
        setSummary(data);
      } catch (error) {
        setError('Failed to fetch survey summary');
        console.error('Error fetching survey summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [surveyId]);

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

  if (!summary) {
    return <div className="flex justify-center items-center min-h-screen">No results found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumb and Actions */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Surveys</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium">Survey Results</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">End</Button>
          <Button variant="outline" onClick={() => window.location.href = `${window.location.pathname}/${surveyId}/detailed`}>View Details</Button>
          <Button variant="outline">Share</Button>
          <Button variant="outline">Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prize Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mt-2">
              <div className="w-24 h-24 relative">
                <Progress value={33} className="h-24 w-24 rotate-90" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="text-2xl font-bold">₹100</div>
                  <div className="text-xs text-muted-foreground">of ₹300</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_responses || 0}</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary?.average_time_seconds || 0)}s</div>
            <p className="text-xs text-muted-foreground">Per response</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Response Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.timeline_data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="responses" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.demographics?.gender || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="response_text" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Geographic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.demographics?.geography || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="response_text" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.demographics?.age_groups || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="response_text" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
