import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="lg:pl-64 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-4 sm:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>
      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
