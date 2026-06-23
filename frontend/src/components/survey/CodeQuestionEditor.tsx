"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Trash2, Code2, FlaskConical, Eye, EyeOff, Upload, Download } from "lucide-react";
import { toast } from "sonner";

// Supported languages
const LANGUAGES = [
  { id: "python", name: "Python" },
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "java", name: "Java" },
  { id: "cpp", name: "C++" },
  { id: "c", name: "C" },
  { id: "go", name: "Go" },
  { id: "rust", name: "Rust" },
];

export interface CodeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  hidden: boolean;
}

export interface CodeSettings {
  defaultLanguage: string;
  allowedLanguages: string[];
  testCases: CodeTestCase[];
  starterCode: Record<string, string>;
}

interface CodeQuestionEditorProps {
  settings: CodeSettings;
  onChange: (settings: CodeSettings) => void;
}

const DEFAULT_SETTINGS: CodeSettings = {
  defaultLanguage: "python",
  allowedLanguages: ["python", "javascript"],
  testCases: [],
  starterCode: {},
};

export function CodeQuestionEditor({
  settings = DEFAULT_SETTINGS,
  onChange,
}: CodeQuestionEditorProps) {
  const [activeStarterLang, setActiveStarterLang] = useState(
    settings.defaultLanguage || "python"
  );

  // Generate unique ID for test cases
  const generateId = () => `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add a new test case
  const addTestCase = () => {
    const newTestCase: CodeTestCase = {
      id: generateId(),
      input: "",
      expectedOutput: "",
      hidden: false,
    };
    onChange({
      ...settings,
      testCases: [...(settings.testCases || []), newTestCase],
    });
  };

  // Update a test case
  const updateTestCase = (id: string, updates: Partial<CodeTestCase>) => {
    onChange({
      ...settings,
      testCases: (settings.testCases || []).map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    });
  };

  // Remove a test case
  const removeTestCase = (id: string) => {
    onChange({
      ...settings,
      testCases: (settings.testCases || []).filter((tc) => tc.id !== id),
    });
  };

  // File input ref for test case upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse test cases from uploaded .txt file
  // Format:
  //   ---       (separator between test cases)
  //   INPUT:    (marks start of input section)
  //   ...       (input lines)
  //   OUTPUT:   (marks start of expected output section)
  //   ...       (output lines)
  //   HIDDEN    (optional — marks test case as hidden)
  const handleUploadTestCases = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      toast.error('Please upload a .txt file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const blocks = text.split('---').map(b => b.trim()).filter(Boolean);

        if (blocks.length === 0) {
          toast.error('No test cases found. Use --- to separate test cases.');
          return;
        }

        const parsed: CodeTestCase[] = blocks.map(block => {
          const lines = block.split('\n');
          let input = '';
          let output = '';
          let hidden = false;
          let section: 'none' | 'input' | 'output' = 'none';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.toUpperCase() === 'INPUT:') { section = 'input'; continue; }
            if (trimmed.toUpperCase() === 'OUTPUT:') { section = 'output'; continue; }
            if (trimmed.toUpperCase() === 'HIDDEN') { hidden = true; continue; }

            if (section === 'input') input += (input ? '\n' : '') + line;
            if (section === 'output') output += (output ? '\n' : '') + line;
          }

          return {
            id: generateId(),
            input: input.trim(),
            expectedOutput: output.trim(),
            hidden,
          };
        }).filter(tc => tc.input !== '' || tc.expectedOutput !== '');

        if (parsed.length === 0) {
          toast.error('Could not parse any test cases. Check the file format.');
          return;
        }

        onChange({
          ...settings,
          testCases: [...(settings.testCases || []), ...parsed],
        });

        toast.success(`Imported ${parsed.length} test case${parsed.length > 1 ? 's' : ''}`);
      } catch (err) {
        console.error('Parse error:', err);
        toast.error('Failed to parse test cases file');
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Download a template .txt file showing the format
  const downloadTemplate = () => {
    const template = `---
INPUT:
4 9
2 7 11 15
OUTPUT:
0 1
---
INPUT:
3 6
3 2 4
OUTPUT:
1 2
HIDDEN
---
INPUT:
2 6
3 3
OUTPUT:
0 1
HIDDEN
`;
    const blob = new Blob([template], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'test_cases_template.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle language in allowed list
  const toggleLanguage = (langId: string) => {
    const currentAllowed = settings.allowedLanguages || [];
    const isAllowed = currentAllowed.includes(langId);

    if (isAllowed && currentAllowed.length === 1) {
      // Can't remove the last language
      return;
    }

    const newAllowed = isAllowed
      ? currentAllowed.filter((l) => l !== langId)
      : [...currentAllowed, langId];

    // If removing the default language, set a new default
    let newDefault = settings.defaultLanguage;
    if (isAllowed && settings.defaultLanguage === langId) {
      newDefault = newAllowed[0];
    }

    onChange({
      ...settings,
      allowedLanguages: newAllowed,
      defaultLanguage: newDefault,
    });
  };

  // Update starter code for a language
  const updateStarterCode = (langId: string, code: string) => {
    onChange({
      ...settings,
      starterCode: {
        ...(settings.starterCode || {}),
        [langId]: code,
      },
    });
  };

  return (
    <div className="space-y-6 border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Code2 className="h-4 w-4" />
        Code Question Settings
      </div>

      {/* Language Selection */}
      <div className="space-y-3">
        <Label>Allowed Languages</Label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const isAllowed = (settings.allowedLanguages || []).includes(lang.id);
            const isDefault = settings.defaultLanguage === lang.id;

            return (
              <Badge
                key={lang.id}
                variant={isAllowed ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  isAllowed ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-gray-100"
                }`}
                onClick={() => toggleLanguage(lang.id)}
              >
                {lang.name}
                {isDefault && isAllowed && (
                  <span className="ml-1 text-xs opacity-75">(default)</span>
                )}
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">
          Click to toggle. At least one language must be selected.
        </p>
      </div>

      {/* Default Language */}
      <div className="space-y-2">
        <Label>Default Language</Label>
        <Select
          value={settings.defaultLanguage || "python"}
          onValueChange={(value) =>
            onChange({ ...settings, defaultLanguage: value })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(settings.allowedLanguages || ["python"]).map((langId) => {
              const lang = LANGUAGES.find((l) => l.id === langId);
              return (
                <SelectItem key={langId} value={langId}>
                  {lang?.name || langId}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Starter Code */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="starter-code">
          <AccordionTrigger className="text-sm">
            Starter Code (Optional)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <div className="flex gap-2">
                {(settings.allowedLanguages || []).map((langId) => {
                  const lang = LANGUAGES.find((l) => l.id === langId);
                  return (
                    <Button
                      key={langId}
                      variant={activeStarterLang === langId ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveStarterLang(langId)}
                    >
                      {lang?.name || langId}
                    </Button>
                  );
                })}
              </div>
              <Textarea
                placeholder={`Enter starter code for ${
                  LANGUAGES.find((l) => l.id === activeStarterLang)?.name ||
                  activeStarterLang
                }...`}
                value={(settings.starterCode || {})[activeStarterLang] || ""}
                onChange={(e) => updateStarterCode(activeStarterLang, e.target.value)}
                className="font-mono text-sm min-h-[150px]"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Test Cases */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Test Cases
          </Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} title="Download template file">
              <Download className="h-4 w-4 mr-1" />
              Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="Upload test cases from .txt file">
              <Upload className="h-4 w-4 mr-1" />
              Upload .txt
            </Button>
            <Button variant="outline" size="sm" onClick={addTestCase}>
              <Plus className="h-4 w-4 mr-1" />
              Add Test Case
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleUploadTestCases}
            className="hidden"
          />
        </div>

        {(settings.testCases || []).length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm border-2 border-dashed rounded-lg">
            No test cases yet. Click "Add Test Case" to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {(settings.testCases || []).map((testCase, index) => (
              <Card key={testCase.id} className="bg-white">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Test Case {index + 1}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateTestCase(testCase.id, { hidden: !testCase.hidden })
                        }
                        className="h-8 px-2"
                        title={testCase.hidden ? "Make visible" : "Hide from participants"}
                      >
                        {testCase.hidden ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTestCase(testCase.id)}
                        className="h-8 px-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {testCase.hidden && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      Hidden - participants won't see this test
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="py-3 px-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Input (stdin)</Label>
                      <Textarea
                        placeholder="Enter input..."
                        value={testCase.input}
                        onChange={(e) =>
                          updateTestCase(testCase.id, { input: e.target.value })
                        }
                        className="font-mono text-sm min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Expected Output</Label>
                      <Textarea
                        placeholder="Enter expected output..."
                        value={testCase.expectedOutput}
                        onChange={(e) =>
                          updateTestCase(testCase.id, {
                            expectedOutput: e.target.value,
                          })
                        }
                        className="font-mono text-sm min-h-[80px]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Hidden test cases are used for grading but not shown to participants.
        </p>
      </div>
    </div>
  );
}
