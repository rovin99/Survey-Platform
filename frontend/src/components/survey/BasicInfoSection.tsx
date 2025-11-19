import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SurveyBasicInfo } from "@/types/survey";

interface BasicInfoSectionProps {
  basicInfo: SurveyBasicInfo;
  onUpdate: (updates: Partial<SurveyBasicInfo>) => void;
}

export function BasicInfoSection({ basicInfo, onUpdate }: BasicInfoSectionProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Survey Title"
          value={basicInfo.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        <Textarea
          placeholder="Survey Description"
          value={basicInfo.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </CardContent>
    </>
  );
} 