import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="space-y-6 p-6 bg-white min-h-screen">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2"></div>
        </div>
        <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Statistics Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-gray-200">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Skeleton */}
      <Card className="border-gray-200">
        <CardHeader>
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Skeleton */}
      <Card className="border-gray-200">
        <CardHeader>
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mt-2"></div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
