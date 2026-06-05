"use client";

import { useState, useCallback, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
  Code2,
  FlaskConical,
} from "lucide-react";
import {
  codeExecutionService,
  SUPPORTED_LANGUAGES,
  TestCase,
  TestResult,
  ExecutionResult,
} from "@/services/codeExecution.service";

interface CodeEditorProps {
  questionId: number;
  defaultLanguage?: string;
  allowedLanguages?: string[];
  testCases?: TestCase[];
  starterCode?: Record<string, string>;
  value?: {
    code: string;
    language: string;
  };
  onChange: (value: { code: string; language: string }) => void;
  readOnly?: boolean;
}

// Get language extension for CodeMirror
const getLanguageExtension = (language: string) => {
  switch (language) {
    case "javascript":
    case "typescript":
      return javascript({ typescript: language === "typescript" });
    case "python":
      return python();
    case "java":
      return java();
    case "cpp":
    case "c":
      return cpp();
    default:
      return javascript();
  }
};

export function CodeEditor({
  questionId,
  defaultLanguage = "python",
  allowedLanguages,
  testCases = [],
  starterCode = {},
  value,
  onChange,
  readOnly = false,
}: CodeEditorProps) {
  const [language, setLanguage] = useState(value?.language || defaultLanguage);
  const [code, setCode] = useState(
    value?.code || starterCode[defaultLanguage] || codeExecutionService.getBoilerplate(defaultLanguage)
  );
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [activeTab, setActiveTab] = useState("output");
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Available languages (intersection of allowed and supported)
  const availableLanguages = allowedLanguages
    ? allowedLanguages.filter((l) => SUPPORTED_LANGUAGES[l])
    : Object.keys(SUPPORTED_LANGUAGES);

  // Update parent when code or language changes
  useEffect(() => {
    onChange({ code, language });
  }, [code, language]);

  // Handle language change
  const handleLanguageChange = useCallback(
    (newLanguage: string) => {
      setLanguage(newLanguage);
      // Use starter code if available, otherwise use boilerplate
      const newCode =
        starterCode[newLanguage] ||
        codeExecutionService.getBoilerplate(newLanguage);
      setCode(newCode);
    },
    [starterCode]
  );

  // Run code with custom input
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput("");
    setExecutionError(null);
    setActiveTab("output");

    try {
      const result: ExecutionResult = await codeExecutionService.executeCode(
        language,
        code,
        customInput
      );

      // Combine compile and run output
      let outputText = "";
      if (result.compile?.output) {
        outputText += `[Compilation]\n${result.compile.output}\n\n`;
      }
      if (result.run.stdout) {
        outputText += result.run.stdout;
      }
      if (result.run.stderr) {
        outputText += `\n[Errors]\n${result.run.stderr}`;
      }
      if (result.run.code !== 0) {
        outputText += `\n[Exit code: ${result.run.code}]`;
      }

      setOutput(outputText || "(No output)");
    } catch (error: any) {
      setExecutionError(error.message);
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run test cases
  const handleRunTests = async () => {
    if (testCases.length === 0) {
      setExecutionError("No test cases available");
      return;
    }

    setIsTestRunning(true);
    setTestResults([]);
    setExecutionError(null);
    setActiveTab("tests");

    try {
      const results = await codeExecutionService.runTestCases(
        language,
        code,
        testCases
      );
      setTestResults(results);
    } catch (error: any) {
      setExecutionError(error.message);
    } finally {
      setIsTestRunning(false);
    }
  };

  // Calculate test summary
  const passedTests = testResults.filter((r) => r.passed).length;
  const totalTests = testResults.length;
  const visibleTestCases = testCases.filter((tc) => !tc.hidden);

  return (
    <div className="space-y-4">
      {/* Language Selector and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-gray-500" />
          <Select
            value={language}
            onValueChange={handleLanguageChange}
            disabled={readOnly}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {SUPPORTED_LANGUAGES[lang]?.name || lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCode}
            disabled={isRunning || readOnly}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run
          </Button>

          {testCases.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleRunTests}
              disabled={isTestRunning || readOnly}
            >
              {isTestRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4 mr-2" />
              )}
              Run Tests ({visibleTestCases.length})
            </Button>
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className="border rounded-lg overflow-hidden">
        <CodeMirror
          value={code}
          height="300px"
          theme={oneDark}
          extensions={[getLanguageExtension(language)]}
          onChange={(value) => setCode(value)}
          editable={!readOnly}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>

      {/* Input/Output Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="input" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  Input
                </TabsTrigger>
                <TabsTrigger value="output" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  Output
                </TabsTrigger>
                {testCases.length > 0 && (
                  <TabsTrigger value="tests" className="gap-2">
                    <FlaskConical className="h-4 w-4" />
                    Tests
                    {testResults.length > 0 && (
                      <Badge
                        variant={passedTests === totalTests ? "default" : "destructive"}
                        className="ml-1"
                      >
                        {passedTests}/{totalTests}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>
          </CardHeader>

          <CardContent>
            <TabsContent value="input" className="mt-0">
              <Textarea
                placeholder="Enter input for your program (stdin)..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                disabled={readOnly}
              />
            </TabsContent>

            <TabsContent value="output" className="mt-0">
              <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm min-h-[120px] whitespace-pre-wrap overflow-auto">
                {isRunning ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </div>
                ) : output ? (
                  output
                ) : (
                  <span className="text-gray-500">
                    Click "Run" to execute your code
                  </span>
                )}
              </div>
            </TabsContent>

            {testCases.length > 0 && (
              <TabsContent value="tests" className="mt-0 space-y-3">
                {isTestRunning ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Running tests...
                  </div>
                ) : testResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Click "Run Tests" to test your code against {visibleTestCases.length} test case(s)
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
                      {passedTests === totalTests ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium">
                        {passedTests}/{totalTests} tests passed
                      </span>
                    </div>

                    {/* Individual Test Results (only show non-hidden) */}
                    {testResults
                      .filter((r) => !r.hidden)
                      .map((result, index) => (
                        <div
                          key={result.testCaseId}
                          className={`p-3 rounded-lg border ${
                            result.passed
                              ? "border-green-200 bg-green-50"
                              : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {result.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">
                              Test Case {index + 1}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Input:</p>
                              <pre className="bg-white p-2 rounded border text-xs overflow-auto">
                                {result.input || "(empty)"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Expected:</p>
                              <pre className="bg-white p-2 rounded border text-xs overflow-auto">
                                {result.expectedOutput || "(empty)"}
                              </pre>
                            </div>
                          </div>

                          {!result.passed && (
                            <div className="mt-2">
                              <p className="text-gray-500 text-sm mb-1">
                                Your output:
                              </p>
                              <pre className="bg-white p-2 rounded border text-xs overflow-auto text-red-600">
                                {result.actualOutput || result.error || "(empty)"}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}

                    {/* Hidden tests summary */}
                    {testResults.filter((r) => r.hidden).length > 0 && (
                      <div className="p-3 rounded-lg bg-gray-100 text-sm text-gray-600">
                        + {testResults.filter((r) => r.hidden).length} hidden test(s)
                        {" - "}
                        {testResults.filter((r) => r.hidden && r.passed).length} passed
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>

      {/* Error Display */}
      {executionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {executionError}
        </div>
      )}
    </div>
  );
}
