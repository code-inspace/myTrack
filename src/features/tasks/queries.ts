export const taskQueryKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskQueryKeys.all, "list"] as const,
  list: (date: string) => [...taskQueryKeys.lists(), { date }] as const,
  active: () => [...taskQueryKeys.all, "active"] as const,
  completions: () => ["completions"] as const,
  completionList: (date: string) => [...taskQueryKeys.completions(), { date }] as const,
};
