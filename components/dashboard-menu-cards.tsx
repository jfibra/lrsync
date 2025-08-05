
"use client"

import type React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { User, Users, FileText, ArrowRight, DollarSign } from "lucide-react"
import type { UserRole } from "@/types/auth"

interface MenuCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: "blue" | "red" | "orange" | "green" | "navy" | "indigo"
}

function MenuCard({ title, description, href, icon, color }: MenuCardProps) {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
    red: "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700",
    orange: "from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    green: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    navy: "from-[#001f3f] to-[#001f3f] hover:from-[#001f3f] hover:to-[#001f3f]",
    indigo: "from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700",
  }

  const bgColorClasses = {
    blue: "bg-blue-50/80 hover:bg-blue-100/80 border-blue-200",
    red: "bg-red-50/80 hover:bg-red-100/80 border-red-200",
    orange: "bg-orange-50/80 hover:bg-orange-100/80 border-orange-200",
    green: "bg-green-50/80 hover:bg-green-100/80 border-green-200",
    navy: "bg-[#f9f9f9] hover:bg-[#fff] border-[#001f3f]",
    indigo: "bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-200",
  }

  return (
    <Link href={href} className="group">
      <Card
        className={`${bgColorClasses[color]} border-2 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer h-full animate-in fade-in-50 slide-in-from-bottom-4`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`bg-gradient-to-r ${colorClasses[color]} p-4 rounded-xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg text-gray-900 group-hover:text-gray-800 transition-colors">
                  {title}
                </h3>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

interface DashboardMenuCardsProps {
  userRole: UserRole
}

export function DashboardMenuCards({ userRole }: DashboardMenuCardsProps) {
  const getMenuItems = () => {
    // Base items for all roles
    const baseItems = [
      {
        title: "My Profile",
        description: "View and manage your personal profile information and settings.",
        href: `/dashboard/${userRole.replace("_", "-")}/profile`,
        icon: <User className="h-6 w-6" />,
        color: "orange" as const,
      },
    ]

    // Add Sales Management, TIN Library, and User Management for Super Admin and Admin only
    if (userRole === "super_admin" || userRole === "admin") {
      return [
        {
          title: "Sales Management",
          description: "Track and manage monthly sales records with comprehensive reporting tools.",
          href: `/dashboard/${userRole.replace("_", "-")}/sales`,
          icon: <DollarSign className="h-6 w-6" />,
          color: "green" as const,
        },
        {
          title: "TIN Library",
          description: "Manage comprehensive taxpayer listings for sales and purchases tracking.",
          href: `/dashboard/${userRole.replace("_", "-")}/tin-library`,
          icon: <FileText className="h-6 w-6" />,
          color: "blue" as const,
        },
        {
          title: "Commission Generator",
          description: "View and analyze sales commission records with detailed reporting capabilities.",
          href: `/dashboard/${userRole.replace("_", "-")}/commission`,
          icon: <Users className="h-6 w-6" />,
          color: "navy" as const,
        },
        {
          title: "Commission Reports",
          description: "View and manage commission reports",
          href: `/dashboard/${userRole.replace("_", "-")}/commission-reports`,
          icon: <FileText className="h-6 w-6" />,
          color: "indigo" as const,
        },
        {
          title: "User Management",
          description: "Create, edit, and manage system users and their permissions across the platform.",
          href: `/dashboard/${userRole.replace("_", "-")}/users`,
          icon: <Users className="h-6 w-6" />,
          color: "red" as const,
        },
        ...baseItems, // My Profile
      ]
    }

    // Add Sales Management, TIN Library, and User Management for Secretary only
    if (userRole === "secretary") {
      return [
        {
          title: "Sales Management",
          description: "Track and manage monthly sales records with comprehensive reporting tools.",
          href: `/dashboard/${userRole.replace("_", "-")}/sales`,
          icon: <DollarSign className="h-6 w-6" />,
          color: "green" as const,
        },
        {
          title: "TIN Library",
          description: "Manage comprehensive taxpayer listings for sales and purchases tracking.",
          href: `/dashboard/${userRole.replace("_", "-")}/tin-library`,
          icon: <FileText className="h-6 w-6" />,
          color: "blue" as const,
        },
        {
          title: "Commission Generator",
          description: "View sales commission records for your assigned area with detailed insights.",
          href: `/dashboard/${userRole.replace("_", "-")}/commission`,
          icon: <Users className="h-6 w-6" />,
          color: "red" as const,
        },
        ...baseItems, // My Profile
      ]
    }

    // Secretary only gets My Profile
    return baseItems
  }

  const menuItems = getMenuItems()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {menuItems.map((item, index) => (
        <div
          key={index}
          className="animate-in fade-in-50 slide-in-from-bottom-4"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <MenuCard
            title={item.title}
            description={item.description}
            href={item.href}
            icon={item.icon}
            color={item.color}
          />
        </div>
      ))}
    </div>
  )
}
