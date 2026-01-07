import { Bell, Search, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const shifts = [
  { id: "morning", name: "Morning", time: "6:00 AM - 2:00 PM" },
  { id: "afternoon", name: "Afternoon", time: "2:00 PM - 10:00 PM" },
  { id: "night", name: "Night", time: "10:00 PM - 6:00 AM" },
];

const branches = [
  { id: "all", name: "All Branches" },
  { id: "monrovia-central", name: "Monrovia Central" },
  { id: "buchanan", name: "Buchanan Station" },
  { id: "gbarnga", name: "Gbarnga Station" },
];

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Title Section */}
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Date Display */}
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{today}</span>
          </div>

          {/* Branch Selector */}
          <Select defaultValue="all">
            <SelectTrigger className="w-44 bg-card">
              <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Shift Selector */}
          <Select defaultValue="morning">
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="Select shift" />
            </SelectTrigger>
            <SelectContent>
              {shifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{shift.name}</span>
                    <span className="text-xs text-muted-foreground">{shift.time}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <Button variant="outline" size="icon" className="bg-card">
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <Button variant="outline" size="icon" className="bg-card relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
