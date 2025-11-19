"use client";

import {
	Bell,
	ChevronDown,
	LogOut,
	Search,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface NavbarProps {
	userType: "Conductor" | "Participant";
}

export function Navbar({ userType }: NavbarProps) {
	const { user, logout } = useAuth();
	const [searchOpen, setSearchOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [tags, setTags] = useState("");

	const handleLogout = async () => {
		try {
			await logout();
		} catch (error) {
			console.error('Logout failed:', error);
		}
	};

	const notifications = [
		{
			id: "1",
			title: "New Response",
			message: "You received a new survey response",
			icon: "📝",
			timestamp: "2 mins ago",
		},
		{
			id: "2",
			title: "Survey Completed",
			message: "Your survey has reached its target responses",
			icon: "✅",
			timestamp: "1 hour ago",
		},
	];

	return (
		<nav className="border-b">
			<div className="flex h-16 items-center px-4">
				<Link href="/dashboard" className="text-xl font-bold">
					<h1 className="text-2xl font-bold text-blue-600 pl-4">SurveyPro</h1>
				</Link>

				<div className="flex-1 flex justify-center">
					<Popover open={searchOpen} onOpenChange={setSearchOpen}>
						<PopoverTrigger asChild>
							<div className="flex items-center space-x-2">
								<Search className="h-4 w-4" />
								<Input placeholder="Search Surveys" className="w-[450px]" />
							</div>
						</PopoverTrigger>
						<PopoverContent className="w-[400px] p-4">
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="title">Title</Label>
									<Input
										id="title"
										placeholder="Search by title..."
										value={title}
										onChange={(e) => setTitle(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="tags">Tags</Label>
									<Input
										id="tags"
										placeholder="Enter comma separated tags..."
										value={tags}
										onChange={(e) => setTags(e.target.value)}
									/>
								</div>
								<div className="flex items-center space-x-2">
									<Checkbox id="active" />
									<Label htmlFor="active">Active surveys only</Label>
								</div>
								<Button
									className="w-full"
									disabled={!title.trim() && !tags.trim()}
								>
									Search
								</Button>
							</div>
						</PopoverContent>
					</Popover>
				</div>

				<div className="ml-auto flex items-center space-x-4">
					<div className="flex items-center space-x-2 border rounded-lg px-3 py-1.5">
						<div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
							{userType[0]}
						</div>
						<span>{userType}</span>
					</div>

					<Popover>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="icon" className="relative">
								<Bell className="h-5 w-5" />
								<span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
									2
								</span>
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-2">
								{notifications.map((notification) => (
									<div
										key={notification.id}
										className="flex items-start space-x-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
									>
										<div className="text-lg">{notification.icon}</div>
										<div className="flex-1">
											<h4 className="text-sm font-semibold">
												{notification.title}
											</h4>
											<p className="text-sm text-muted-foreground">
												{notification.message}
											</p>
											<span className="text-xs text-muted-foreground">
												{notification.timestamp}
											</span>
										</div>
									</div>
								))}
							</div>
						</PopoverContent>
					</Popover>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<Settings className="h-5 w-5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<User className="mr-2 h-4 w-4" />
								<span>Profile ({user?.username})</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleLogout}>
								<LogOut className="mr-2 h-4 w-4" />
								<span>Logout</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</nav>
	);
}
