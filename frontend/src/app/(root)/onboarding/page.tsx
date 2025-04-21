"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Upload, UserCircle, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Skills and subskills lists
const SKILLS = [
	"FRONTEND",
	"BACKEND",
	"BLOCKCHAIN",
	"MOBILE",
	"DESIGN",
	"COMMUNITY",
	"GROWTH",
	"CONTENT",
	"OTHER",
];

const SUBSKILLS = [
	"REACT",
	"SVELTE",
	"ANGULAR",
	"VUE",
	"SOLIDJS",
	"REDUX",
	"ELM",
	"JAVASCRIPT",
	"TYPESCRIPT",
	"NODEJS",
	"PHP",
	"LARAVEL",
	"PYTHON",
	"DJANGO",
	"KOTLIN",
	"SWIFT",
	"JAVA",
	"C",
	"C_PLUS_PLUS",
	"RUBY",
	"RUBY_ON_RAILS",
	"GO",
	"MYSQL",
	"POSTGRES",
	"MONGODB",
	"PEARL",
	"SCALA",
	"ELIXIR",
	"HASKELL",
	"ERLA",
	"DENO",
	"DART",
	"ASP_NET",
	"RUST",
	"SOLIDITY",
	"MOVE",
	"ANDROID",
	"IOS",
	"FLUTTER",
	"REACT_NATIVE",
	"UI_UX_DESIGN",
	"GRAPHIC_DESIGN",
	"ILLUSTRATION",
	"GAME_DESIGN",
	"PRESENTATION_DESIGN",
	"COMMUNITY_MANAGER",
	"DISCORD_MODERATOR",
	"BUSINESS_DEVELOPMENT",
	"DIGITAL_MARKETING",
	"MARKETING",
	"RESEARCH",
	"PHOTOGRAPHY",
	"VIDEO",
	"VIDEO_EDITING",
	"WRITING",
	"SOCIAL_MEDIA",
	"DATA_ANALYTICS",
	"OPERATIONS",
	"PRODUCT_FEEDBACK",
	"PRODUCT_MANAGER",
];

// Function to format enum values for display
const formatEnumValue = (value: string): string => {
	return value
		.split("_")
		.map((word) => word.charAt(0) + word.slice(1).toLowerCase())
		.join(" ");
};

// Countries list
const COUNTRIES = [
	{ value: "us", label: "United States" },
	{ value: "uk", label: "United Kingdom" },
	{ value: "ca", label: "Canada" },
	{ value: "au", label: "Australia" },
	{ value: "in", label: "India" },
	{ value: "de", label: "Germany" },
	{ value: "fr", label: "France" },
	{ value: "jp", label: "Japan" },
];

// Use cases for conductors
const USE_CASES = [
	{ value: "academic_research", label: "Academic Research" },
	{ value: "market_research", label: "Market Research" },
	{ value: "customer_feedback", label: "Customer Feedback" },
	{ value: "employee_feedback", label: "Employee Feedback" },
	{ value: "student_project", label: "Student Project" },
	{ value: "personal_use", label: "Personal Use" },
	{ value: "other", label: "Other" },
];

export default function DashboardPage() {
	const { user, logout } = useAuth();
	const router = useRouter();

	// State for onboarding flow
	const [step, setStep] = useState<"role" | "conductor" | "participant">(
		"role",
	);
	const [role, setRole] = useState<"conductor" | "participant" | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		profilePhoto: null as File | null,
		primaryUseCase: "",
		otherUseCase: "",
		skills: "",
		subSkills: "",
		age: "",
		country: "",
	});

	// Handle form input changes
	const handleChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	// Handle file input change
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setFormData((prev) => ({ ...prev, profilePhoto: file }));
	};

	// Handle role selection
	const handleRoleSelect = (selectedRole: "conductor" | "participant") => {
		setRole(selectedRole);
		setStep(selectedRole);
	};

	// Handle form submission
	const handleSubmit = () => {
		if (role === "conductor") {
			router.push("/cdashboard");
		} else {
			router.push("/pdashboard");
		}
	};

	// Render role selection step
	const renderRoleSelection = () => (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
			<Card
				className="border-2 cursor-pointer hover:border-gray-400 transition-all dark:hover:border-gray-600"
				onClick={() => handleRoleSelect("conductor")}
			>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-xl">Conductor</CardTitle>
					<UserCircle className="h-8 w-8 text-gray-700 dark:text-gray-300" />
				</CardHeader>
				<CardContent>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Create and manage surveys, analyze responses, and pay participants
						for their valuable input.
					</p>
				</CardContent>
			</Card>

			<Card
				className="border-2 cursor-pointer hover:border-gray-400 transition-all dark:hover:border-gray-600"
				onClick={() => handleRoleSelect("participant")}
			>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-xl">Participant</CardTitle>
					<Users className="h-8 w-8 text-gray-700 dark:text-gray-300" />
				</CardHeader>
				<CardContent>
					<p className="text-sm text-gray-600 dark:text-gray-400">
						Take part in surveys and get paid for sharing your opinions and
						feedback.
					</p>
				</CardContent>
			</Card>
		</div>
	);

	// Render conductor form
	const renderConductorForm = () => (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="conductor-name" className="text-sm font-medium">
					Name
				</label>
				<Input
					id="conductor-name"
					placeholder="Your full name"
					value={formData.name}
					onChange={(e) => handleChange("name", e.target.value)}
				/>
			</div>

			<div className="space-y-2">
				<label htmlFor="conductor-photo" className="text-sm font-medium">
					Profile Photo
				</label>
				<div className="flex items-center space-x-2">
					<Input
						id="conductor-photo"
						type="file"
						onChange={handleFileChange}
						className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-300"
					/>
					<Upload className="h-5 w-5 text-gray-500 dark:text-gray-300" />
				</div>
			</div>

			<div className="space-y-2">
				<label htmlFor="primary-use-case" className="text-sm font-medium">
					Primary Use Case
				</label>
				<Select
					onValueChange={(value) => handleChange("primaryUseCase", value)}
				>
					<SelectTrigger id="primary-use-case">
						<SelectValue placeholder="Select a use case" />
					</SelectTrigger>
					<SelectContent>
						{USE_CASES.map((useCase) => (
							<SelectItem key={useCase.value} value={useCase.value}>
								{useCase.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{formData.primaryUseCase === "other" && (
				<div className="space-y-2">
					<label htmlFor="other-use-case" className="text-sm font-medium">
						Please specify
					</label>
					<Input
						id="other-use-case"
						placeholder="Describe your use case"
						value={formData.otherUseCase}
						onChange={(e) => handleChange("otherUseCase", e.target.value)}
					/>
				</div>
			)}

			<Button className="w-full" onClick={handleSubmit}>
				Continue <ArrowRight className="ml-2 h-4 w-4" />
			</Button>
		</div>
	);

	// Render participant form
	const renderParticipantForm = () => (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="participant-name" className="text-sm font-medium">
					Name
				</label>
				<Input
					id="participant-name"
					placeholder="Your full name"
					value={formData.name}
					onChange={(e) => handleChange("name", e.target.value)}
				/>
			</div>

			<div className="space-y-2">
				<label htmlFor="participant-photo" className="text-sm font-medium">
					Profile Photo
				</label>
				<div className="flex items-center space-x-2">
					<Input
						id="participant-photo"
						type="file"
						onChange={handleFileChange}
						className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-gray-700 dark:file:text-gray-300"
					/>
					<Upload className="h-5 w-5 text-gray-500 dark:text-gray-300" />
				</div>
			</div>

			<div className="space-y-2">
				<label htmlFor="skills" className="text-sm font-medium">
					Skills
				</label>
				<Select onValueChange={(value) => handleChange("skills", value)}>
					<SelectTrigger id="skills">
						<SelectValue placeholder="Select your primary skills" />
					</SelectTrigger>
					<SelectContent>
						{SKILLS.map((skill) => (
							<SelectItem key={skill} value={skill}>
								{formatEnumValue(skill)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<label htmlFor="sub-skills" className="text-sm font-medium">
					Sub-Skills
				</label>
				<Select onValueChange={(value) => handleChange("subSkills", value)}>
					<SelectTrigger id="sub-skills">
						<SelectValue placeholder="Select your specific skills" />
					</SelectTrigger>
					<SelectContent>
						{SUBSKILLS.map((subskill) => (
							<SelectItem key={subskill} value={subskill}>
								{formatEnumValue(subskill)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<label htmlFor="birth-year" className="text-sm font-medium">
					Birth Year
				</label>
				<Select onValueChange={(value) => handleChange("age", value)}>
					<SelectTrigger id="birth-year">
						<SelectValue placeholder="Select your birth year" />
					</SelectTrigger>
					<SelectContent>
						{Array.from({ length: 70 }, (_, i) => 2005 - i).map((year) => (
							<SelectItem key={year} value={year.toString()}>
								{year}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<label htmlFor="country" className="text-sm font-medium">
					Country
				</label>
				<Select onValueChange={(value) => handleChange("country", value)}>
					<SelectTrigger id="country">
						<SelectValue placeholder="Select your country" />
					</SelectTrigger>
					<SelectContent>
						{COUNTRIES.map((country) => (
							<SelectItem key={country.value} value={country.value}>
								{country.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Button className="w-full" onClick={handleSubmit}>
				Continue <ArrowRight className="ml-2 h-4 w-4" />
			</Button>
		</div>
	);

	// Return appropriate step based on state
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-xl mx-auto">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
						{step === "role" && "Choose Your Role"}
						{step === "conductor" && "Complete Your Conductor Profile"}
						{step === "participant" &&
							"Complete Your Participant Profile"}
					</h1>
					<Button variant="outline" onClick={logout}>
						Logout
					</Button>
				</div>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>
								{step === "role" && "Choose Your Role"}
								{step === "conductor" && "Complete Your Conductor Profile"}
								{step === "participant" &&
									"Complete Your Participant Profile"}
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{step === "role" && renderRoleSelection()}
						{step === "conductor" && renderConductorForm()}
						{step === "participant" && renderParticipantForm()}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
