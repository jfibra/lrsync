"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Banknote, Building2, Calculator, ClipboardList, Eye, ShoppingCart, Contact } from "lucide-react"
import Link from "next/link"
import type { UserRole } from "@/types/auth"

interface DashboardMenuCardsProps {
  userRole: UserRole
}

export function DashboardMenuCards({ userRole }: DashboardMenuCardsProps) {
  const getMenuItems = () => {
    switch (userRole) {
      case "super_admin":
        return [
          {
            title: "Sales Records",
            description: "View and manage all sales data",
            icon: Banknote,
            href: "/dashboard/super-admin/sales",
            color: "from-green-500 to-green-600",
            bgColor: "bg-green-50/80 border-green-200",
            badge: "All Areas",
            badgeColor: "bg-green-100 text-green-800",
          },
          {
            title: "Purchases Records",
            description: "View and manage all purchase data",
            icon: ShoppingCart,
            href: "/dashboard/super-admin/purchases",
            color: "from-red-500 to-red-600",
            bgColor: "bg-red-50/80 border-red-200",
            badge: "All Areas",
            badgeColor: "bg-red-100 text-red-800",
          },
          {
            title: "TIN Library",
            description: "Manage taxpayer identification numbers",
            icon: Building2,
            href: "/dashboard/super-admin/tin-library",
            color: "from-orange-500 to-orange-600",
            bgColor: "bg-orange-50/80 border-orange-200",
            badge: "Database",
            badgeColor: "bg-orange-100 text-orange-800",
          },
          {
            title: "Commission Generator",
            description: "Track sales and calculate commissions",
            icon: Calculator,
            href: "/dashboard/super-admin/commission",
            color: "from-purple-500 to-purple-600",
            bgColor: "bg-purple-50/80 border-purple-200",
            badge: "Financial",
            badgeColor: "bg-purple-100 text-purple-800",
          },
          {
            title: "Commission Reports",
            description: "View and manage commission reports",
            icon: ClipboardList,
            href: "/dashboard/super-admin/commission-reports",
            color: "from-indigo-500 to-indigo-600",
            bgColor: "bg-indigo-50/80 border-indigo-200",
            badge: "Reports",
            badgeColor: "bg-indigo-100 text-indigo-800",
          },
          {
            title: "Commission Agent Breakdown",
            description: "Manage commission agent breakdown records",
            icon: Users,
            href: "/dashboard/super-admin/commission-agent-breakdown",
            color: "from-teal-500 to-teal-600",
            bgColor: "bg-teal-50/80 border-teal-200",
            badge: "CRUD",
            badgeColor: "bg-teal-100 text-teal-800",
          },
          {
            title: "User Management",
            description: "Manage system users and permissions",
            icon: Users,
            href: "/dashboard/super-admin/users",
            color: "from-blue-500 to-blue-600",
            bgColor: "bg-blue-50/80 border-blue-200",
            badge: "Admin Only",
            badgeColor: "bg-blue-100 text-blue-800",
          },
          {
            title: "Activity Tracker",
            description: "Monitor all system activities and user actions with comprehensive analytics",
            icon: Contact,
            href: "/dashboard/super-admin/activity-tracker",
            color: "from-yellow-500 to-yellow-600",
            bgColor: "bg-yellow-50/80 border-yellow-200",
            badge: "Your Area",
            badgeColor: "bg-yellow-100 text-yellow-800",
          },
          {
            title: "My Profile",
            description: "Manage your profile information",
            icon: Building2,
            href: "/dashboard/super-admin/my-profile",
            color: "from-green-500 to-green-600",
            bgColor: "bg-green-50/80 border-green-200",
            badge: "Your Area",
            badgeColor: "bg-green-100 text-green-800",
          },
        ]

      case "admin":
        return [
          {
            title: "User Management",
            description: "Manage users in your area",
            icon: Users,
            href: "/dashboard/admin/users",
            color: "from-blue-500 to-blue-600",
            bgColor: "bg-blue-50/80 border-blue-200",
            badge: "Area Admin",
            badgeColor: "bg-blue-100 text-blue-800",
          },
          {
            title: "Sales Records",
            description: "View and manage sales data",
            icon: Banknote,
            href: "/dashboard/admin/sales",
            color: "from-green-500 to-green-600",
            bgColor: "bg-green-50/80 border-green-200",
            badge: "Your Area",
            badgeColor: "bg-green-100 text-green-800",
          },
          {
            title: "Commission Generator",
            description: "Track sales and calculate commissions",
            icon: Calculator,
            href: "/dashboard/admin/commission",
            color: "from-purple-500 to-purple-600",
            bgColor: "bg-purple-50/80 border-purple-200",
            badge: "Financial",
            badgeColor: "bg-purple-100 text-purple-800",
          },
          {
            title: "TIN Library",
            description: "Manage taxpayer identification numbers",
            icon: Building2,
            href: "/dashboard/admin/tin-library",
            color: "from-orange-500 to-orange-600",
            bgColor: "bg-orange-50/80 border-orange-200",
            badge: "Database",
            badgeColor: "bg-orange-100 text-orange-800",
          },
        ]

      case "secretary":
        return [
          {
            title: "Sales Records",
            description: "View and manage sales data",
            icon: Banknote,
            href: "/dashboard/secretary/sales",
            color: "from-green-500 to-green-600",
            bgColor: "bg-green-50/80 border-green-200",
            badge: "Your Area",
            badgeColor: "bg-green-100 text-green-800",
          },
          {
            title: "Purchases Records",
            description: "View and manage purchase data",
            icon: ShoppingCart,
            href: "/dashboard/secretary/purchases",
            color: "from-red-500 to-red-600",
            bgColor: "bg-red-50/80 border-red-200",
            badge: "Your Area",
            badgeColor: "bg-red-100 text-red-800",
          },
          {
            title: "TIN Library",
            description: "Browse taxpayer identification numbers",
            icon: Building2,
            href: "/dashboard/secretary/tin-library",
            color: "from-orange-500 to-orange-600",
            bgColor: "bg-orange-50/80 border-orange-200",
            badge: "Reference",
            badgeColor: "bg-orange-100 text-orange-800",
          },
          {
            title: "Commission Generator",
            description: "Track sales and calculate commissions",
            icon: Calculator,
            href: "/dashboard/secretary/commission",
            color: "from-purple-500 to-purple-600",
            bgColor: "bg-purple-50/80 border-purple-200",
            badge: "Financial",
            badgeColor: "bg-purple-100 text-purple-800",
          },
          {
            title: "Commission Reports",
            description: "View commission reports from your area",
            icon: Eye,
            href: "/dashboard/secretary/commission-reports",
            color: "from-indigo-500 to-indigo-600",
            bgColor: "bg-indigo-50/80 border-indigo-200",
            badge: "View Only",
            badgeColor: "bg-indigo-100 text-indigo-800",
          },
        ]

      default:
        return []
    }
  }

  const menuItems = getMenuItems()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {menuItems.map((item, index) => (
        <Card
          key={item.title}
          className={`${item.bgColor} border-2 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in fade-in-50 slide-in-from-bottom-4 group cursor-pointer`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div
                className={`bg-gradient-to-r ${item.color} p-3 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <Badge className={`${item.badgeColor} font-medium`}>{item.badge}</Badge>
            </div>
            <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
              {item.title}
            </CardTitle>
            <CardDescription className="text-gray-600 group-hover:text-gray-500 transition-colors">
              {item.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link href={item.href}>
              <Button
                className={`w-full bg-gradient-to-r ${item.color} text-white font-semibold shadow-md hover:shadow-lg transition-all duration-300 group-hover:scale-105`}
              >
                Access {item.title}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
