"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// Types matching the survey creation page
interface ParsedQuestion {
    id: string;
    text: string;
    type: "multiple-choice" | "single-choice" | "text" | "rating";
    options: { id: string; text: string }[];
    mandatory: boolean;
    correctAnswers: string;
    points: number;
    explanation: string;
}

interface DraftQuestion {
    question_id: number;
    question_text: string;
    question_type: string;
    mandatory: boolean;
    correct_answers: string;
    points: number;
    explanation: string;
}

interface DraftOption {
    optionId: string;
    question_id: number;
    option_text: string;
}

interface Props {
    onQuestionsLoaded: (
        questions: ParsedQuestion[],
        draftQuestions: DraftQuestion[],
        draftOptions: DraftOption[]
    ) => void;
    existingQuestionCount: number;
}

// Supports up to 25 option columns (Option A through Option Y)
const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');

// Excel row is dynamic — option columns are detected at parse time
type ExcelRow = Record<string, string | number | boolean | undefined>;

export function QuizTemplateUploader({ onQuestionsLoaded, existingQuestionCount }: Props) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Generate and download template Excel file
    const downloadTemplate = () => {
        // Build template rows with all 25 option columns so users see the full range
        const makeRow = (data: Record<string, string | number>) => {
            const row: Record<string, string | number> = { ...data };
            for (const letter of OPTION_LETTERS) {
                if (!((`Option ${letter}`) in row)) {
                    row[`Option ${letter}`] = '';
                }
            }
            return row;
        };

        const templateData = [
            makeRow({
                'Question': 'What is the capital of France?',
                'Type': 'single-choice',
                'Option A': 'London',
                'Option B': 'Paris',
                'Option C': 'Berlin',
                'Option D': 'Madrid',
                'Correct Answer': 'B',
                'Points': 1,
                'Explanation': 'Paris is the capital and largest city of France.',
                'Mandatory': 'Yes'
            }),
            makeRow({
                'Question': 'Select all prime numbers from the list:',
                'Type': 'multiple-choice',
                'Option A': '2',
                'Option B': '4',
                'Option C': '5',
                'Option D': '9',
                'Option E': '11',
                'Correct Answer': 'A,C,E',
                'Points': 2,
                'Explanation': '2, 5, and 11 are prime numbers.',
                'Mandatory': 'Yes'
            }),
            makeRow({
                'Question': 'What programming language is React built with?',
                'Type': 'single-choice',
                'Option A': 'Python',
                'Option B': 'Java',
                'Option C': 'JavaScript',
                'Option D': 'C++',
                'Correct Answer': 'C',
                'Points': 1,
                'Explanation': 'React is a JavaScript library for building user interfaces.',
                'Mandatory': 'No'
            })
        ];

        // Ensure column order: Question, Type, Option A..Y, Correct Answer, Points, Explanation, Mandatory
        const headers = [
            'Question', 'Type',
            ...OPTION_LETTERS.map(l => `Option ${l}`),
            'Correct Answer', 'Points', 'Explanation', 'Mandatory'
        ];

        const ws = XLSX.utils.json_to_sheet(templateData, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Quiz Template');

        // Set column widths
        ws['!cols'] = [
            { wch: 50 },  // Question
            { wch: 15 },  // Type
            ...OPTION_LETTERS.map(() => ({ wch: 18 })),  // Options A-Y
            { wch: 15 },  // Correct Answer
            { wch: 8 },   // Points
            { wch: 40 },  // Explanation
            { wch: 10 },  // Mandatory
        ];

        XLSX.writeFile(wb, 'quiz_template.xlsx');
        toast.success('Template downloaded!');
    };

    // Parse uploaded Excel file
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setUploadResult(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

            if (jsonData.length === 0) {
                throw new Error('No data found in the Excel file');
            }

            // Parse and validate questions
            const parsedQuestions: ParsedQuestion[] = [];
            const draftQuestions: DraftQuestion[] = [];
            const draftOptions: DraftOption[] = [];
            const errors: string[] = [];

            jsonData.forEach((row, index) => {
                const rowNum = index + 2; // +2 for header row and 1-based indexing
                
                // Validate required fields
                if (!row['Question']?.trim()) {
                    errors.push(`Row ${rowNum}: Missing question text`);
                    return;
                }

                if (!row['Correct Answer']?.toString().trim()) {
                    errors.push(`Row ${rowNum}: Missing correct answer`);
                    return;
                }

                // Determine question type
                const typeRaw = row['Type']?.toLowerCase().trim() || 'single-choice';
                let questionType: "multiple-choice" | "single-choice" | "text" | "rating" = 'single-choice';
                
                if (typeRaw.includes('multi')) {
                    questionType = 'multiple-choice';
                } else if (typeRaw.includes('text')) {
                    questionType = 'text';
                } else if (typeRaw.includes('rating')) {
                    questionType = 'rating';
                }

                // Collect options dynamically (A through Y — up to 25)
                const options: { id: string; text: string }[] = [];
                
                OPTION_LETTERS.forEach((letter, optIndex) => {
                    const optionText = row[`Option ${letter}`]?.toString().trim();
                    if (optionText) {
                        options.push({
                            id: `${existingQuestionCount + index + 1}-opt-${optIndex}`,
                            text: optionText
                        });
                    }
                });

                // Validate: choice questions need at least 2 options
                if ((questionType === 'single-choice' || questionType === 'multiple-choice') && options.length < 2) {
                    errors.push(`Row ${rowNum}: Choice questions need at least 2 options`);
                    return;
                }

                // Parse correct answer (convert letter to index)
                const correctAnswerRaw = row['Correct Answer'].toString().toUpperCase().trim();
                let correctAnswers = '';
                
                if (questionType === 'text') {
                    correctAnswers = correctAnswerRaw;
                } else {
                    // Convert letters (A-Y) to 1-based indices
                    const letters = correctAnswerRaw.split(',').map(s => s.trim());
                    const indices = letters.map(letter => {
                        const idx = OPTION_LETTERS.indexOf(letter);
                        return idx >= 0 ? (idx + 1).toString() : null;
                    }).filter(Boolean);
                    correctAnswers = indices.join(',');
                }

                // Parse other fields
                const points = typeof row['Points'] === 'number' ? row['Points'] : 1;
                const explanation = row['Explanation']?.toString() || '';
                const mandatoryRaw = row['Mandatory']?.toString().toLowerCase() || 'yes';
                const mandatory = mandatoryRaw === 'yes' || mandatoryRaw === 'true' || mandatoryRaw === '1';

                const questionId = existingQuestionCount + index + 1;

                // Create parsed question for UI
                parsedQuestions.push({
                    id: questionId.toString(),
                    text: row['Question'].trim(),
                    type: questionType,
                    options,
                    mandatory,
                    correctAnswers,
                    points,
                    explanation
                });

                // Create draft question for backend
                draftQuestions.push({
                    question_id: questionId,
                    question_text: row['Question'].trim(),
                    question_type: questionType,
                    mandatory,
                    correct_answers: correctAnswers,
                    points,
                    explanation
                });

                // Create draft options for backend
                options.forEach(opt => {
                    draftOptions.push({
                        optionId: opt.id,
                        question_id: questionId,
                        option_text: opt.text
                    });
                });
            });

            // Report errors if any
            if (errors.length > 0) {
                const errorMessage = errors.slice(0, 5).join('\n') + 
                    (errors.length > 5 ? `\n...and ${errors.length - 5} more errors` : '');
                toast.error(`Validation errors:\n${errorMessage}`);
                setUploadResult({ success: false, message: `${errors.length} validation errors found` });
                return;
            }

            if (parsedQuestions.length === 0) {
                throw new Error('No valid questions found in the file');
            }

            // Success - pass data to parent
            onQuestionsLoaded(parsedQuestions, draftQuestions, draftOptions);
            setUploadResult({ 
                success: true, 
                message: `Successfully loaded ${parsedQuestions.length} questions!` 
            });
            toast.success(`Loaded ${parsedQuestions.length} questions from Excel!`);

        } catch (error) {
            console.error('Error parsing Excel file:', error);
            const message = error instanceof Error ? error.message : 'Failed to parse file';
            setUploadResult({ success: false, message });
            toast.error(message);
        } finally {
            setIsProcessing(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    Import Quiz from Excel
                </CardTitle>
                <CardDescription className="text-xs">
                    Upload an Excel file with your quiz questions to quickly create your quiz
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Template download */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                    <div className="flex-1">
                        <p className="text-sm font-medium">1. Download Template</p>
                        <p className="text-xs text-gray-500">Get the Excel template with the correct format</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadTemplate}
                        className="flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </Button>
                </div>

                {/* File upload */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                    <div className="flex-1">
                        <p className="text-sm font-medium">2. Upload Your File</p>
                        <p className="text-xs text-gray-500">Fill in the template and upload it here</p>
                    </div>
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="quiz-excel-upload"
                        />
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                            className="flex items-center gap-2"
                        >
                            {isProcessing ? (
                                <>Processing...</>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Upload Excel
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Upload result */}
                {uploadResult && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                        uploadResult.success 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-red-50 border border-red-200'
                    }`}>
                        {uploadResult.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`text-sm ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {uploadResult.message}
                        </span>
                    </div>
                )}

                {/* Format guide */}
                <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700">Template Format Guide</summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <p><strong>Columns:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Question</strong> - The question text (required)</li>
                            <li><strong>Type</strong> - single-choice, multiple-choice, text, or rating</li>
                            <li><strong>Option A-Y</strong> - Answer options (up to 25)</li>
                            <li><strong>Correct Answer</strong> - Letter(s) of correct option(s), e.g., &quot;B&quot; or &quot;A,C,E&quot;</li>
                            <li><strong>Points</strong> - Points for this question (default: 1)</li>
                            <li><strong>Explanation</strong> - Explanation shown after quiz</li>
                            <li><strong>Mandatory</strong> - Yes/No (default: Yes)</li>
                        </ul>
                    </div>
                </details>
            </CardContent>
        </Card>
    );
}

