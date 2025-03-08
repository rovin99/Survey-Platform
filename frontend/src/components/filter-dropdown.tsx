"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { FilterType } from "@/types/survey-analysis";

interface FilterDropdownProps {
	onFilterChange: (value: FilterType) => void;
}

export function FilterDropdown({ onFilterChange }: FilterDropdownProps) {
	return (
		<Select onValueChange={(value) => onFilterChange(value as FilterType)}>
			<SelectTrigger className="w-[180px]">
				<SelectValue placeholder="Filter Audience" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="age">Age</SelectItem>
				<SelectItem value="geography">Geographic Location</SelectItem>
				<SelectItem value="gender">Gender</SelectItem>
			</SelectContent>
		</Select>
	);
}
