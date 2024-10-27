// app/page.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Navigation */}
        <nav className="flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold">Your App</h1>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Register</Button>
            </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">Welcome to Your App</h1>
            <p className="text-xl text-gray-600 mb-8">
              A secure and modern platform for your needs
            </p>
            <Button size="lg" className="mr-4">Get Started</Button>
            <Button size="lg" variant="outline">Learn More</Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 py-12">
          <Card>
            <CardHeader>
              <CardTitle>Feature One</CardTitle>
              <CardDescription>Description of your first main feature</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Detailed explanation of how this feature benefits users.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feature Two</CardTitle>
              <CardDescription>Description of your second main feature</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Detailed explanation of how this feature benefits users.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Feature Three</CardTitle>
              <CardDescription>Description of your third main feature</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Detailed explanation of how this feature benefits users.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}