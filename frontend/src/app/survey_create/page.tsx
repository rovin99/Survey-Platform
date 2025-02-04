"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Question {
  id: string
  text: string
  type: "multiple-choice" | "single-choice" | "text" | "rating"
  options: Option[]
}

interface Option {
  id: string
  text: string
}

export default function SurveyCreatePage() {
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState("")
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: "1",
      text: "What is your preferred method of communication?",
      type: "multiple-choice",
      options: [
        { id: "1", text: "Email" },
        { id: "2", text: "Phone" },
      ],
    },
  ])

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: "",
      type: "multiple-choice",
      options: [{ id: Date.now().toString(), text: "" }],
    }
    setQuestions([...questions, newQuestion])
  }

  const deleteQuestion = (questionId: string) => {
    setQuestions(questions.filter((q) => q.id !== questionId))
  }

  const addOption = (questionId: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [...q.options, { id: Date.now().toString(), text: "" }],
            }
          : q,
      ),
    )
  }

  const deleteOption = (questionId: string, optionId: string) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((opt) => opt.id !== optionId),
            }
          : q,
      ),
    )
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && currentTag.trim()) {
      e.preventDefault()
      setTags([...tags, currentTag.trim()])
      setCurrentTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Create New Survey</h1>
      <p className="text-muted-foreground mb-8">Design your survey by adding questions and customizing settings</p>

      <div className="space-y-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Survey Details</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Survey Title</label>
              <Input placeholder="Enter survey title" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea placeholder="Enter survey description" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Prize Pool ($)</label>
                <Input type="number" placeholder="e.g., 1000" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prize Per Response ($)</label>
                <Input type="number" placeholder="e.g., 5" min="0" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tags / Categories</label>
              <div className="space-y-2">
                <Input
                  placeholder="Enter tags and press Enter"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={handleAddTag}
                />
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Eligibility & Visibility</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Anyone can participate</SelectItem>
                  <SelectItem value="private">Private - Invite only</SelectItem>
                  <SelectItem value="unlisted">Unlisted - Only accessible via link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Eligibility Criteria</label>
              <Textarea
                placeholder="Specify who can participate in this survey (e.g., 'Must be 18+ years old', 'Must be a registered user')"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Questions</h2>

          <div className="space-y-6">
            {questions.map((question) => (
              <div key={question.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <Select defaultValue={question.type}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Question type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                      <SelectItem value="single-choice">Single Choice</SelectItem>
                      <SelectItem value="text">Text Input</SelectItem>
                      <SelectItem value="rating">Rating Scale</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                    className="text-destructive"
                  >
                    Delete
                  </Button>
                </div>

                <Input
                  value={question.text}
                  placeholder="Enter question text"
                  onChange={(e) =>
                    setQuestions(questions.map((q) => (q.id === question.id ? { ...q, text: e.target.value } : q)))
                  }
                />

                {question.type !== "text" && (
                  <div className="space-y-2 ml-4">
                    {question.options.map((option) => (
                      <div key={option.id} className="flex gap-2 items-center">
                        <Input
                          value={option.text}
                          placeholder="Option text"
                          className="flex-1"
                          onChange={(e) =>
                            setQuestions(
                              questions.map((q) =>
                                q.id === question.id
                                  ? {
                                      ...q,
                                      options: q.options.map((opt) =>
                                        opt.id === option.id ? { ...opt, text: e.target.value } : opt,
                                      ),
                                    }
                                  : q,
                              ),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteOption(question.id, option.id)}
                          className="text-destructive"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addOption(question.id)} className="mt-2">
                      + Add Option
                    </Button>
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" onClick={addQuestion} className="w-full">
              + Add Question
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

