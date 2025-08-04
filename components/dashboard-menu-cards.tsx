"use client"

import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, TrendingUp, FileText, Library, User, DollarSign } from "lucide-react"
import Link from "next/link"
import type { UserRole } from "@/types/auth"

interface MenuCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
  badge: string
}

function MenuCard({ title, description, href, icon, color, badge }: MenuCardProps) {
  const IconComponent = icon
  return (
    <Link href={href} className="group">
      <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-xl bg-gradient-to-r ${color} shadow-lg`}>
              <IconComponent className="h-6 w-6 text-white" />
            </div>
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
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
    const baseItems = [
      {
        title: "Sales Management",
        description: "Manage and track sales records",
        icon: TrendingUp,
        href: `/dashboard/${userRole}/sales`,
        color: "from-blue-500 to-blue-600",
        badge: "Core",
      },
      {
        title: "Commission",
        description: "Generate commission reports",
        icon: DollarSign,
        href: `/dashboard/${userRole}/commission`,
        color: "from-green-500 to-green-600",
        badge: "Finance",
      },
      {
        title: "TIN Library",
        description: "Taxpayer identification database",
        icon: Library,
        href: `/dashboard/${userRole}/tin-library`,
        color: "from-purple-500 to-purple-600",
        badge: "Reference",
      },
      {
        title: "Profile",
        description: "Manage your account settings",
        icon: User,
        href: `/dashboard/${userRole}/profile`,
        color: "from-gray-500 to-gray-600",
        badge: "Account",
      },
    ]

    // Add role-specific items
    if (userRole === "super_admin" || userRole === "admin") {
      baseItems.splice(1, 0, {
        title: "User Management",
        description: "Manage system users and permissions",
        icon: Users,
        href: `/dashboard/${userRole}/users`,
        color: "from-orange-500 to-orange-600",
        badge: "Admin",
      })
    }

    // Add commission reports for super admin only
    if (userRole === "super_admin") {
      baseItems.splice(3, 0, {
        title: "Commission Reports",
        description: "View and manage commission reports",
        icon: FileText,
        href: `/dashboard/${userRole}/commission-reports`,
        color: "from-indigo-500 to-indigo-600",
        badge: "Reports",
      })
    }

    return baseItems
  }

  const menuItems = getMenuItems()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {menuItems.map((item) => (
        <MenuCard
          key={item.href}
          title={item.title}
          description={item.description}
          href={item.href}
          icon={item.icon}
          color={item.color}
          badge={item.badge}
        />
      ))}
    </div>
  )
}
