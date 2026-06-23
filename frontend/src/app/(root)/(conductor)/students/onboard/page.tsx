"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Upload, Users, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, SkipForward, Download, X } from "lucide-react";
import { authConfig } from "@/lib/api-config";

interface OnboardResult {
  created: string[];
  skipped: string[];
  failed: { email: string; reason: string }[];
}

interface StudentRow {
  email: string;
  firstName?: string;
  lastName?: string;
  rollNo?: string;
  phone?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Header aliases → our canonical field. Headers are normalized (lowercased, separators stripped).
const HEADER_ALIASES: Record<keyof StudentRow, string[]> = {
  email: ["email", "emailaddress", "mail", "emailid"],
  firstName: ["firstname", "first", "fname", "givenname"],
  lastName: ["lastname", "last", "lname", "surname"],
  rollNo: ["rollno", "roll", "rollnumber", "rollnumberno", "regno", "registrationno"],
  phone: ["phone", "phonenumber", "phoneno", "mobile", "mobileno", "contact", "contactno"],
};

export default function OnboardStudentsPage() {
  const router = useRouter();
  const [emailText, setEmailText] = useState("");
  const [fileStudents, setFileStudents] = useState<StudentRow[]>([]);
  const [defaultPassword, setDefaultPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);

  // Parse the textarea into a deduped, lowercased, valid email list
  const parseEmails = (text: string): string[] => {
    const tokens = text.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    return [...new Set(tokens)];
  };

  // Merge textarea emails + file rows, deduped by email. File rows (with names) win over bare emails.
  const buildStudents = (): StudentRow[] => {
    const byEmail = new Map<string, StudentRow>();
    parseEmails(emailText).forEach((e) => {
      if (EMAIL_REGEX.test(e)) byEmail.set(e, { email: e });
    });
    fileStudents.forEach((s) => {
      const e = s.email.trim().toLowerCase();
      if (EMAIL_REGEX.test(e)) byEmail.set(e, { ...s, email: e });
    });
    return [...byEmail.values()];
  };

  const students = buildStudents();
  const invalidEmails = parseEmails(emailText).filter((e) => !EMAIL_REGEX.test(e));

  const downloadTemplate = () => {
    const headers = ["Email", "First Name", "Last Name", "Roll No", "Phone"];
    const example = ["alice@example.com", "Alice", "Kumar", "CS2025001", "9876543210"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "student-onboard-template.xlsx");
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Resolve a value by trying all header aliases for a field (normalize each sheet header).
        const valueFor = (row: Record<string, unknown>, field: keyof StudentRow): string => {
          const aliases = HEADER_ALIASES[field];
          for (const key of Object.keys(row)) {
            const norm = key.toLowerCase().replace(/[\s._-]/g, "");
            if (aliases.includes(norm)) return String(row[key] ?? "").trim();
          }
          return "";
        };

        const parsed: StudentRow[] = [];
        rows.forEach((row) => {
          const email = valueFor(row, "email").toLowerCase();
          if (!email) return;
          parsed.push({
            email,
            firstName: valueFor(row, "firstName"),
            lastName: valueFor(row, "lastName"),
            rollNo: valueFor(row, "rollNo"),
            phone: valueFor(row, "phone"),
          });
        });

        // Fallback for files without our headers: scan every cell for bare emails.
        if (parsed.length === 0) {
          const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          raw.forEach((r) => {
            (r as unknown[]).forEach((cell) => {
              const v = cell?.toString()?.trim()?.toLowerCase();
              if (v && EMAIL_REGEX.test(v)) parsed.push({ email: v });
            });
          });
        }

        if (parsed.length === 0) {
          toast.error("No rows with an email found. Use the template (Download template).");
          return;
        }

        // Dedupe within the file by email (later rows win).
        const deduped = new Map<string, StudentRow>();
        parsed.forEach((s) => deduped.set(s.email, s));
        setFileStudents([...deduped.values()]);
        toast.success(`Loaded ${deduped.size} student(s) from file`);
      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Failed to parse file");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleOnboard = async () => {
    if (students.length === 0) {
      toast.error("Add at least one valid student (paste emails or upload a file)");
      return;
    }
    if (!defaultPassword) {
      toast.error("Set a default password");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${authConfig.baseUrl}${authConfig.paths.bulkOnboard}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ defaultPassword, students }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || data?.message || "Failed to onboard students");
      }
      const r: OnboardResult = data.data;
      setResult(r);
      toast.success(`Created ${r.created.length}, skipped ${r.skipped.length}, failed ${r.failed.length}`);
      // Keep only the rows that failed so the conductor can retry.
      const failedEmails = new Set(r.failed.map((f) => f.email.toLowerCase()));
      setFileStudents((prev) => prev.filter((s) => failedEmails.has(s.email.toLowerCase())));
      setEmailText(r.failed.map((f) => f.email).join("\n"));
    } catch (err) {
      console.error("Onboard error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to onboard students");
    } finally {
      setLoading(false);
    }
  };

  const displayName = (s: StudentRow) => [s.firstName, s.lastName].filter(Boolean).join(" ").trim();

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Onboard Students
          </h1>
          <p className="text-gray-600 text-sm">
            Create student accounts in bulk. Each student logs in with their <strong>email</strong> and the shared default password.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Upload student list</CardTitle>
              <CardDescription>
                Fill the template with <strong>Email, First Name, Last Name, Roll No, Phone</strong> and upload it.
                Names, roll no &amp; phone pre-fill each student&apos;s dashboard. Only Email is required.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
              <Download className="h-4 w-4 mr-2" /> Download template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-center gap-2 text-sm text-primary cursor-pointer hover:bg-gray-50 border-2 border-dashed rounded-lg py-6">
            <Upload className="h-4 w-4" /> Upload Excel / CSV (.xlsx, .xls, .csv)
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          </label>

          {fileStudents.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-sm">
                <span className="font-medium">{fileStudents.length} student(s) from file</span>
                <button
                  type="button"
                  onClick={() => setFileStudents([])}
                  className="text-gray-500 hover:text-red-600 flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Roll No</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileStudents.map((s) => {
                      const valid = EMAIL_REGEX.test(s.email);
                      return (
                        <tr key={s.email} className="border-t">
                          <td className="px-3 py-2">{displayName(s) || <span className="text-gray-400">—</span>}</td>
                          <td className={`px-3 py-2 ${valid ? "" : "text-red-500"}`}>
                            {s.email}{!valid && " (invalid)"}
                          </td>
                          <td className="px-3 py-2">{s.rollNo || <span className="text-gray-400">—</span>}</td>
                          <td className="px-3 py-2">{s.phone || <span className="text-gray-400">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Or paste emails</CardTitle>
          <CardDescription>One per line, or comma/space separated. These are added as email-only students (no name).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={5}
            placeholder={"alice@example.com\nbob@example.com"}
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="font-mono text-sm"
          />
          {invalidEmails.length > 0 && (
            <div className="text-sm text-red-500">{invalidEmails.length} invalid email(s) ignored</div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Default password</CardTitle>
          <CardDescription>
            Shared by all onboarded students for their first login. Must be ≥8 chars with uppercase, lowercase, a digit, and a special character (e.g. <code>Student@123</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              placeholder="Default password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleOnboard} disabled={loading || students.length === 0 || !defaultPassword} className="w-full" size="lg">
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Onboarding…</>
        ) : (
          <><Users className="h-4 w-4 mr-2" /> Onboard {students.length} Student{students.length !== 1 ? "s" : ""}</>
        )}
      </Button>

      {result && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Created: {result.created.length}
            </div>
            {result.skipped.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-amber-700 mb-1">
                  <SkipForward className="h-4 w-4" /> Skipped (already exist): {result.skipped.length}
                </div>
                <div className="text-xs text-gray-500 pl-6 break-words">{result.skipped.join(", ")}</div>
              </div>
            )}
            {result.failed.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-red-600 mb-1">
                  <AlertTriangle className="h-4 w-4" /> Failed: {result.failed.length}
                </div>
                <ul className="text-xs text-gray-500 pl-6 list-disc">
                  {result.failed.map((f) => (
                    <li key={f.email}>{f.email} — {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
