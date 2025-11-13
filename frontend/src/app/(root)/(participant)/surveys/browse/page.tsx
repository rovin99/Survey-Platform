"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SurveyCard } from "@/components/survey-browse/SurveyCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { surveyTakingService } from "@/services/surveyTaking.service";
import type { AvailableSurvey } from "@/types/survey-taking";

export default function SurveyBrowsePage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<AvailableSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSurveys();
  }, [page]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      
      // For now, using mock data since backend endpoint may not be ready
      // TODO: Replace with actual API call when backend is ready
      const mockSurveys: AvailableSurvey[] = [
        {
          id: 1,
          title: "Customer Satisfaction Survey 2024",
          description: "Help us improve our services by sharing your feedback about recent experiences",
          conductor: { id: 1, name: "TechCorp Inc." },
          estimatedTime: "10 minutes",
          questionCount: 15,
          reward: 50,
          category: "Technology",
          status: "PUBLISHED",
        },
        {
          id: 2,
          title: "Product Feature Preferences",
          description: "Share your thoughts on our new product features and help shape future development",
          conductor: { id: 1, name: "Innovation Labs" },
          estimatedTime: "5 minutes",
          questionCount: 8,
          reward: 25,
          category: "Product",
          status: "PUBLISHED",
        },
        {
          id: 3,
          title: "User Experience Research Study",
          description: "Participate in our UX research to make our platform more user-friendly",
          conductor: { id: 2, name: "Design Studio" },
          estimatedTime: "15 minutes",
          questionCount: 20,
          reward: 75,
          category: "Research",
          status: "PUBLISHED",
        },
      ];

      // Filter by search if needed
      const filtered = search
        ? mockSurveys.filter((s) =>
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.description.toLowerCase().includes(search.toLowerCase())
          )
        : mockSurveys;

      setSurveys(filtered);
      setTotalPages(1);

      // Uncomment when backend is ready:
      // const response = await surveyTakingService.getAvailableSurveys({
      //   page,
      //   perPage: 20,
      //   search: search || undefined,
      // });
      // setSurveys(response.items);
      // setTotalPages(response.totalPages);
    } catch (error) {
      console.error("Error fetching surveys:", error);
      toast.error("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchSurveys();
  };

  const handleStartSurvey = (surveyId: number) => {
    router.push(`/survey/take/${surveyId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Available Surveys</h1>
        <p className="text-gray-600">
          Browse and participate in surveys to earn rewards
        </p>
      </div>

      {/* Search */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search surveys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">
          Search
        </Button>
      </div>

      {/* Survey Grid */}
      {surveys.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-2">No surveys found</p>
          <p className="text-gray-400">
            {search
              ? "Try adjusting your search terms"
              : "Check back later for new surveys"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {surveys.map((survey) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                onStart={() => handleStartSurvey(survey.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

