import {
  LayoutDashboard,
  Car,
  Wrench,
  BellRing,
  Bell,
  User,
  Settings,
  FileText,
  Sparkles
} from "lucide-react";

export const navItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "AI Diagnosis",
    href: "/diagnose",
    icon: Sparkles,
  },
  {
    name: "Vehicles",
    href: "/vehicles",
    icon: Car,
  },
  {
    name: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
  },
  {
    name: "Service Slips",
    href: "/slips",
    icon: FileText,
  },
  {
    name: "Reminders",
    href: "/reminders",
    icon: BellRing,
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];
