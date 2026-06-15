import { useQuery } from "@tanstack/react-query"
import { api } from "./api"
import { useAuth } from "./auth-context"
import type { PaginatedResponse, UserProfile } from "./types"

export function useUsersQuery() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<UserProfile>>("/users/")
      return response.data.results
    },
    enabled: user?.role === "admin",
  })
}
