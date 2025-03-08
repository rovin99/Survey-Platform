import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	BarChart3,
	LineChart,
	Lock,
	Send,
	Sparkles,
	Users,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
			<div className="container mx-auto px-4">
				{/* Navigation */}
				<nav className="flex items-center justify-between py-4">
					<h1 className="text-2xl font-bold text-blue-600">SurveyPro</h1>
					<div className="space-x-4">
						<Link href="/login">
							<Button variant="outline">Login</Button>
						</Link>
						<Link href="/register">
							<Button>Create Free Account</Button>
						</Link>
					</div>
				</nav>

				{/* Hero Section */}
				<div className="py-20">
					<div className="max-w-3xl mx-auto text-center">
						<h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
							Create Surveys That Get Results
						</h1>
						<p className="text-xl text-gray-600 mb-8">
							Build beautiful surveys, reach your audience, and make data-driven
							decisions with powerful analytics
						</p>
						<Button size="lg" className="mr-4 bg-blue-600 hover:bg-blue-700">
							Start Creating Free
						</Button>
						<Button size="lg" variant="outline">
							View Templates
						</Button>
					</div>
				</div>

				{/* Stats Section */}
				<div className="flex justify-center gap-8 mb-20">
					<div className="text-center">
						<p className="text-3xl font-bold text-blue-600">100K+</p>
						<p className="text-gray-600">Active Users</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-blue-600">1M+</p>
						<p className="text-gray-600">Surveys Created</p>
					</div>
					<div className="text-center">
						<p className="text-3xl font-bold text-blue-600">5M+</p>
						<p className="text-gray-600">Responses Collected</p>
					</div>
				</div>

				{/* Features Section */}
				<div className="grid md:grid-cols-3 gap-6 py-12">
					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<Sparkles className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Smart Survey Builder</CardTitle>
							<CardDescription>
								Create engaging surveys in minutes
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Drag-and-drop interface, AI-powered question suggestions, and
								customizable templates to create professional surveys quickly.
							</p>
						</CardContent>
					</Card>

					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<Send className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Multi-Channel Distribution</CardTitle>
							<CardDescription>Reach your audience everywhere</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Share surveys via email, SMS, social media, or embed them
								directly on your website with just one click.
							</p>
						</CardContent>
					</Card>

					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<BarChart3 className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Real-Time Analytics</CardTitle>
							<CardDescription>Instant insights from responses</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Advanced analytics dashboard with real-time response tracking,
								custom reports, and exportable data.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Additional Features */}
				<div className="grid md:grid-cols-3 gap-6 py-12">
					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<Users className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Team Collaboration</CardTitle>
							<CardDescription>Work together seamlessly</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Share surveys with team members, manage permissions, and
								collaborate on analysis in real-time.
							</p>
						</CardContent>
					</Card>

					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<LineChart className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Advanced Reporting</CardTitle>
							<CardDescription>Deep dive into your data</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								Generate custom reports, cross-tabulate responses, and export
								data in multiple formats.
							</p>
						</CardContent>
					</Card>

					<Card className="border-2 hover:border-blue-200 transition-all">
						<CardHeader>
							<Lock className="h-8 w-8 text-blue-600 mb-2" />
							<CardTitle>Enterprise Security</CardTitle>
							<CardDescription>Your data is safe with us</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-gray-600">
								GDPR compliant, encrypted data storage, and advanced access
								controls for enterprise-grade security.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
