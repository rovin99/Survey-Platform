"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Users, Loader2, Search, Send, UserPlus, X, RefreshCw } from "lucide-react";
import { authConfig, surveyConfig } from "@/lib/api-config";

interface Student {
  participantId: number;
  userId: number;
  name: string;
  email: string;
  rollNo?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SurveyLite {
  id: number;
  title: string;
  status?: string;
}

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Survey picker (for "Assign to survey")
  const [pickerOpen, setPickerOpen] = useState(false);
  const [surveys, setSurveys] = useState<SurveyLite[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${authConfig.baseUrl}${authConfig.paths.students}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 403) {
        throw new Error("You need a conductor account to view the student roster.");
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || data?.message || "Failed to load students");
      }
      setStudents(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        (s.rollNo ?? "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.email));

  const toggleOne = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((s) => next.delete(s.email));
      else filtered.forEach((s) => next.add(s.email));
      return next;
    });
  };

  const openPicker = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one student");
      return;
    }
    setPickerOpen(true);
    if (surveys.length === 0) {
      setSurveysLoading(true);
      try {
        const res = await fetch(`${surveyConfig.baseUrl}/api/v1/surveys/my`, { credentials: "include" });
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data?.data) ? data.data : data?.data?.surveys ?? [];
        setSurveys(
          (list as Record<string, unknown>[]).map((s) => ({
            id: Number(s.id),
            title: String(s.title ?? "Untitled"),
            status: s.status ? String(s.status) : undefined,
          })),
        );
      } catch {
        toast.error("Failed to load your surveys");
      } finally {
        setSurveysLoading(false);
      }
    }
  };

  // Stash the selected emails and hand off to the proven distribute page (share link + invitations).
  const assignToSurvey = (surveyId: number) => {
    const emails = [...selected];
    try {
      sessionStorage.setItem("prefillEmails", JSON.stringify(emails));
    } catch {
      /* ignore */
    }
    setPickerOpen(false);
    router.push(`/survey/distribute/${surveyId}`);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Students
          </h1>
          <p className="text-gray-600 text-sm">
            Everyone you&apos;ve onboarded. Select students and assign them a survey, or onboard more.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/students/onboard")}>
          <UserPlus className="h-4 w-4 mr-2" /> Onboard students
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>{students.length} student{students.length !== 1 ? "s" : ""} total</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={loadStudents} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={openPicker} disabled={selected.size === 0}>
                <Send className="h-4 w-4 mr-2" /> Assign to survey
                {selected.size > 0 && ` (${selected.size})`}
              </Button>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, email, or roll no…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading students…
            </div>
          ) : error ? (
            <div className="py-10 text-center text-red-600">{error}</div>
          ) : students.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              No students yet.{" "}
              <button className="text-primary hover:underline" onClick={() => router.push("/students/onboard")}>
                Onboard your first students
              </button>
              .
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Roll No</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.email} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(s.email)}
                            onChange={() => toggleOne(s.email)}
                            aria-label={`Select ${s.email}`}
                          />
                        </td>
                        <td className="px-3 py-2">{s.name || <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2">{s.email}</td>
                        <td className="px-3 py-2">{s.rollNo || <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2">{s.phoneNumber || <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2">
                          <Badge variant={s.isActive ? "default" : "secondary"}>
                            {s.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                          No students match “{search}”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Survey picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h2 className="font-semibold">Assign to a survey</h2>
                <p className="text-xs text-gray-500">{selected.size} student(s) selected</p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 overflow-auto">
              {surveysLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading surveys…
                </div>
              ) : surveys.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No surveys found.{" "}
                  <button className="text-primary hover:underline" onClick={() => router.push("/survey/create?new=true")}>
                    Create one
                  </button>
                  .
                </div>
              ) : (
                <ul className="space-y-1">
                  {surveys.map((sv) => (
                    <li key={sv.id}>
                      <button
                        onClick={() => assignToSurvey(sv.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{sv.title}</span>
                        {sv.status && <Badge variant="secondary" className="shrink-0">{sv.status}</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-5 py-3 border-t text-xs text-gray-500">
              You&apos;ll land on the survey&apos;s distribution page with these emails pre-filled — review and click <strong>Send invitations</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
