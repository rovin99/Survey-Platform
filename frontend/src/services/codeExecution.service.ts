// Code Execution Service - Communicates with Piston API

export interface Runtime {
  language: string;
  version: string;
  aliases: string[];
}

export interface ExecutionResult {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  language: string;
  version: string;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  hidden?: boolean;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  hidden?: boolean;
}

// Language configurations with file extensions and boilerplate
export const SUPPORTED_LANGUAGES: Record<string, {
  name: string;
  pistonName: string;
  version: string;
  extension: string;
  boilerplate: string;
}> = {
  python: {
    name: 'Python',
    pistonName: 'python',
    version: '3.10.0',
    extension: 'py',
    boilerplate: `# Write your Python code here

# Read input
# data = input()

# Your code here
print("Hello, World!")
`,
  },
  javascript: {
    name: 'JavaScript',
    pistonName: 'javascript',
    version: '18.15.0',
    extension: 'js',
    boilerplate: `// Write your JavaScript code here

// Read input from stdin
// const readline = require('readline');

// Your code here
console.log("Hello, World!");
`,
  },
  java: {
    name: 'Java',
    pistonName: 'java',
    version: '15.0.2',
    extension: 'java',
    boilerplate: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        // Read input
        // Scanner sc = new Scanner(System.in);

        // Write your Java code here
        System.out.println("Hello, World!");
    }
}
`,
  },
  cpp: {
    name: 'C++',
    pistonName: 'c++',
    version: '10.2.0',
    extension: 'cpp',
    boilerplate: `#include <iostream>
using namespace std;

int main() {
    // Read input
    // int n; cin >> n;

    // Write your C++ code here
    cout << "Hello, World!" << endl;

    return 0;
}
`,
  },
  c: {
    name: 'C',
    pistonName: 'c',
    version: '10.2.0',
    extension: 'c',
    boilerplate: `#include <stdio.h>

int main() {
    // Read input
    // int n; scanf("%d", &n);

    // Write your C code here
    printf("Hello, World!\\n");

    return 0;
}
`,
  },
  go: {
    name: 'Go',
    pistonName: 'go',
    version: '1.16.2',
    extension: 'go',
    boilerplate: `package main

import "fmt"

func main() {
    // Read input
    // var n int
    // fmt.Scan(&n)

    // Write your Go code here
    fmt.Println("Hello, World!")
}
`,
  },
  rust: {
    name: 'Rust',
    pistonName: 'rust',
    version: '1.68.2',
    extension: 'rs',
    boilerplate: `use std::io;

fn main() {
    // Read input
    // let mut input = String::new();
    // io::stdin().read_line(&mut input).unwrap();

    // Write your Rust code here
    println!("Hello, World!");
}
`,
  },
  typescript: {
    name: 'TypeScript',
    pistonName: 'typescript',
    version: '5.0.3',
    extension: 'ts',
    boilerplate: `// Write your TypeScript code here

// Your code here
console.log("Hello, World!");
`,
  },
};

const API_BASE = '/api/piston';

class CodeExecutionService {
  private runtimes: Runtime[] = [];
  private runtimesLoaded = false;

  /**
   * Fetch available runtimes from Piston
   */
  async getRuntimes(): Promise<Runtime[]> {
    if (this.runtimesLoaded && this.runtimes.length > 0) {
      return this.runtimes;
    }

    try {
      const response = await fetch(`${API_BASE}/runtimes`);
      if (!response.ok) {
        throw new Error('Failed to fetch runtimes');
      }
      this.runtimes = await response.json();
      this.runtimesLoaded = true;
      return this.runtimes;
    } catch (error) {
      console.error('Error fetching runtimes:', error);
      return [];
    }
  }

  /**
   * Check if a language is available
   */
  async isLanguageAvailable(language: string): Promise<boolean> {
    const runtimes = await this.getRuntimes();
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) return false;

    return runtimes.some(
      (rt) =>
        rt.language === langConfig.pistonName ||
        rt.aliases.includes(langConfig.pistonName)
    );
  }

  /**
   * Get the runtime for a language
   */
  async getRuntime(language: string): Promise<Runtime | null> {
    const runtimes = await this.getRuntimes();
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) return null;

    return (
      runtimes.find(
        (rt) =>
          rt.language === langConfig.pistonName ||
          rt.aliases.includes(langConfig.pistonName)
      ) || null
    );
  }

  /**
   * Execute code with optional stdin input
   */
  async executeCode(
    language: string,
    code: string,
    stdin: string = ''
  ): Promise<ExecutionResult> {
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Try to get runtime from server, fallback to config
    let runtime = await this.getRuntime(language);
    const version = runtime?.version || langConfig.version;
    const langName = runtime?.language || langConfig.pistonName;

    const response = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: langName,
        version: version,
        files: [
          {
            name: `main.${langConfig.extension}`,
            content: code,
          },
        ],
        stdin: stdin,
        run_timeout: 3000, // 3 seconds max (Piston default limit)
        compile_timeout: 3000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Execution failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Run code against test cases
   */
  async runTestCases(
    language: string,
    code: string,
    testCases: TestCase[]
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      try {
        const result = await this.executeCode(language, code, testCase.input);
        const actualOutput = result.run.stdout.trim();
        const expectedOutput = testCase.expectedOutput.trim();
        const passed = actualOutput === expectedOutput;

        results.push({
          testCaseId: testCase.id,
          passed,
          input: testCase.input,
          expectedOutput,
          actualOutput,
          error: result.run.stderr || undefined,
          hidden: testCase.hidden,
        });
      } catch (error: any) {
        results.push({
          testCaseId: testCase.id,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: '',
          error: error.message,
          hidden: testCase.hidden,
        });
      }
    }

    return results;
  }

  /**
   * Get boilerplate code for a language
   */
  getBoilerplate(language: string): string {
    return SUPPORTED_LANGUAGES[language]?.boilerplate || '';
  }

  /**
   * Get display name for a language
   */
  getLanguageName(language: string): string {
    return SUPPORTED_LANGUAGES[language]?.name || language;
  }
}

export const codeExecutionService = new CodeExecutionService();
