export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  stats: (period: string) => [...dashboardQueryKeys.all, "stats", { period }] as const,
};
