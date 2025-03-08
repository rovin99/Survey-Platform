import { Navbar } from "@/components/navbar";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main>
      <Navbar userType="Conductor" />
      {children}
    </main>
  );
}
