"use client"

import type React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { User, Users, FileText, ArrowRight } from "lucide-react"
import type { UserRole } from "@/types/auth"

interface MenuCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: "blue" | "red" | "orange"
}

function MenuCard({ title, description, href, icon, color }: MenuCardProps) {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-700",
    red: "bg-red-600 hover:bg-red-700",
    orange: "bg-orange-600 hover:bg-orange-700",
  }

  const bgColorClasses = {
    blue: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    red: "bg-red-50 hover:bg-red-100 border-red-200",
    orange: "bg-orange-50 hover:bg-orange-100 border-orange-200",
  }

  return (
    <Link href={href} className="group">
      <Card
        className={`${bgColorClasses[color]} border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer h-full animate-in fade-in-50 slide-in-from-bottom-4`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`${colorClasses[color]} p-4 rounded-xl text-white shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-110`}
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

    // Add User Management and TIN Library for Super Admin and Admin only
    if (userRole === "super_admin" || userRole === "admin") {
      return [
        {
          title: "User Management",
          description: "Create, edit, and manage system users and their permissions across the platform.",
          href: `/dashboard/${userRole.replace("_", "-")}/users`,
          icon: <Users className="h-6 w-6" />,
          color: "red" as const,
        },
        {
          title: "TIN Library",
          description: "Manage comprehensive taxpayer listings for sales and purchases tracking.",
          href: `/dashboard/${userRole.replace("_", "-")}/tin-library`,
          icon: <FileText className="h-6 w-6" />,
          color: "blue" as const,
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
