import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner"

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar userType="Participant" />
      {children}
      <Toaster />
    </main>
  );
}
