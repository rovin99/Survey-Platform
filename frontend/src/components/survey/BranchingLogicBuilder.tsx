"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, GitBranch } from 'lucide-react';

export interface BranchingRule {
  condition: 'equals' | 'not_equals' | 'includes';
  value: string;
  action: 'skip_to' | 'end_survey';
  targetQuestionIndex?: number;
}

interface Props {
  questionIndex: number;
  options: string[];
  totalQuestions: number;
  initialRules?: BranchingRule[];
  onChange: (rules: BranchingRule[]) => void;
}

export function BranchingLogicBuilder({
  questionIndex,
  options,
  totalQuestions,
  initialRules = [],
  onChange
}: Props) {
  const [rules, setRules] = useState<BranchingRule[]>(initialRules);

  // Only allow branching to future questions
  const availableTargetQuestions = Array.from(
    { length: totalQuestions - questionIndex - 1 },
    (_, i) => questionIndex + i + 2 // +2 because we want to skip at least one question
  );

  // Filter valid options (non-empty)
  const validOptions = options.filter(opt => opt && opt.trim().length > 0);

  const addRule = () => {
    if (validOptions.length === 0) return;
    
    const newRule: BranchingRule = {
      condition: 'equals',
      value: validOptions[0],
      action: 'skip_to',
      targetQuestionIndex: availableTargetQuestions[0]
    };
    const updated = [...rules, newRule];
    setRules(updated);
    onChange(updated);
  };

  const removeRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);
    onChange(updated);
  };

  const updateRule = (index: number, updates: Partial<BranchingRule>) => {
    const updated = rules.map((rule, i) =>
      i === index ? { ...rule, ...updates } : rule
    );
    setRules(updated);
    onChange(updated);
  };

  if (validOptions.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4 border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-purple-600" />
          Branching Logic (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-xs text-gray-500 mb-3">
            Add rules to skip questions or end survey based on answers
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-200">
                <span className="text-xs font-medium text-gray-600">IF</span>
                
                {/* Value Select */}
                <Select
                  value={rule.value}
                  onValueChange={(v) => updateRule(index, { value: v })}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validOptions.map((opt, idx) => (
                      <SelectItem key={`${opt}-${idx}`} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-xs font-medium text-gray-600">THEN</span>

                {/* Action Select */}
                <Select
                  value={rule.action}
                  onValueChange={(v) => {
                    const updates: Partial<BranchingRule> = { action: v as any };
                    if (v === 'end_survey') {
                      updates.targetQuestionIndex = undefined;
                    } else if (!rule.targetQuestionIndex && availableTargetQuestions.length > 0) {
                      updates.targetQuestionIndex = availableTargetQuestions[0];
                    }
                    updateRule(index, updates);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip_to" className="text-xs">Skip to</SelectItem>
                    <SelectItem value="end_survey" className="text-xs">End Survey</SelectItem>
                  </SelectContent>
                </Select>

                {/* Target Question (if applicable) */}
                {rule.action === 'skip_to' && availableTargetQuestions.length > 0 && (
                  <Select
                    value={rule.targetQuestionIndex?.toString()}
                    onValueChange={(v) => updateRule(index, { targetQuestionIndex: parseInt(v) })}
                  >
                    <SelectTrigger className="h-8 text-xs w-[100px]">
                      <SelectValue placeholder="Question" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargetQuestions.map((qNum) => (
                        <SelectItem key={qNum} value={qNum.toString()} className="text-xs">
                          Q{qNum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRule(index)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          onClick={addRule}
          disabled={availableTargetQuestions.length === 0 && rules.length > 0}
          className="h-8 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
        
        {availableTargetQuestions.length === 0 && (
          <p className="text-xs text-gray-500 mt-2">
            This is the last question - branching not available
          </p>
        )}
      </CardContent>
    </Card>
  );
}

