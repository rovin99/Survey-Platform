"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Upload, Users, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, SkipForward } from "lucide-react";
import { authConfig } from "@/lib/api-config";

interface OnboardResult {
  created: string[];
  skipped: string[];
  failed: { email: string; reason: string }[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardStudentsPage() {
  const router = useRouter();
  const [emailText, setEmailText] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);

  // Parse the textarea into a deduped, lowercased, valid email list
  const parseEmails = (text: string): string[] => {
    const tokens = text.split(/[\s,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    return [...new Set(tokens)];
  };

  const parsedEmails = parseEmails(emailText);
  const validEmails = parsedEmails.filter((e) => EMAIL_REGEX.test(e));
  const invalidEmails = parsedEmails.filter((e) => !EMAIL_REGEX.test(e));

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const found: string[] = [];
        rows.forEach((row) => {
          (row as any[]).forEach((cell) => {
            const v = cell?.toString()?.trim()?.toLowerCase();
            if (v && EMAIL_REGEX.test(v)) found.push(v);
          });
        });
        if (found.length === 0) {
          toast.error("No valid emails found in the file");
          return;
        }
        // Merge with existing, dedupe
        const merged = [...new Set([...parseEmails(emailText), ...found])];
        setEmailText(merged.join("\n"));
        toast.success(`Loaded ${found.length} email(s) from file`);
      } catch (err) {
        console.error("Error parsing file:", err);
        toast.error("Failed to parse file");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  }, [emailText]);

  const handleOnboard = async () => {
    if (validEmails.length === 0) {
      toast.error("Add at least one valid email");
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
        body: JSON.stringify({ defaultPassword, emails: validEmails }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error?.message || data?.message || "Failed to onboard students");
      }
      const r: OnboardResult = data.data;
      setResult(r);
      toast.success(`Created ${r.created.length}, skipped ${r.skipped.length}, failed ${r.failed.length}`);
      // Keep only the emails that failed so the conductor can retry
      setEmailText(r.failed.map((f) => f.email).join("\n"));
    } catch (err: any) {
      console.error("Onboard error:", err);
      toast.error(err.message || "Failed to onboard students");
    } finally {
      setLoading(false);
    }
  };

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
          <CardTitle>Student emails</CardTitle>
          <CardDescription>Paste emails (one per line, or comma/space separated), or upload an Excel/CSV file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={8}
            placeholder={"alice@example.com\nbob@example.com"}
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
              <Upload className="h-4 w-4" /> Upload Excel/CSV
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <div className="text-sm text-gray-500">
              <span className="text-green-600 font-medium">{validEmails.length} valid</span>
              {invalidEmails.length > 0 && (
                <span className="text-red-500 ml-2">{invalidEmails.length} invalid</span>
              )}
            </div>
          </div>
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

      <Button onClick={handleOnboard} disabled={loading || validEmails.length === 0 || !defaultPassword} className="w-full" size="lg">
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Onboarding…</>
        ) : (
          <><Users className="h-4 w-4 mr-2" /> Onboard {validEmails.length} Student{validEmails.length !== 1 ? "s" : ""}</>
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
