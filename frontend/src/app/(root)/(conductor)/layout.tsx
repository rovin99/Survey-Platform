import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner"


export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<main>
			<Navbar userType="Conductor" />
			{children}
			<Toaster />
			
		</main>
	);
}
