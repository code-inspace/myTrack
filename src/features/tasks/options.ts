export const TASK_CATEGORIES = [
  { id: "Fitness", label: "Fitness & Sport", icon: "Dumbbell", color: "#D4F63D" },
  { id: "Health", label: "Santé & Nutrition", icon: "Heart", color: "#34D399" },
  { id: "Productivity", label: "Productivité & Travail", icon: "Briefcase", color: "#60A5FA" },
  { id: "Learning", label: "Apprentissage & Lecture", icon: "BookOpen", color: "#F472B6" },
  { id: "Mindfulness", label: "Méditation & Sommeil", icon: "Sparkles", color: "#A78BFA" },
  { id: "General", label: "Général", icon: "CheckCircle", color: "#9CA3AF" },
] as const;

export const TRACKING_TYPE_OPTIONS = [
  { id: "BOOLEAN", label: "Validation simple", description: "Fait ou non fait", defaultUnit: null },
  { id: "NUMBER", label: "Répétitions / Nombre", description: "Cible chiffrée (ex: 50 pompes)", defaultUnit: "reps" },
  { id: "DURATION", label: "Durée / Chrono", description: "Temps cible (ex: 30 min)", defaultUnit: "min" },
  { id: "QUANTITY", label: "Quantité / Volume", description: "Mesure cible (ex: 2 litres, 20 pages)", defaultUnit: "unités" },
] as const;

export const RECURRENCE_OPTIONS = [
  { id: "DAILY", label: "Quotidien" },
  { id: "WEEKDAYS", label: "Lun - Ven" },
  { id: "WEEKLY", label: "Hebdomadaire" },
  { id: "CUSTOM", label: "Jours personnalisés" },
  { id: "ONCE", label: "Une fois" },
] as const;

// Ordered starting on Monday (1 to 6, then 0 for Dimanche)
export const DAYS_OF_WEEK = [
  { dayIndex: 1, short: "Lun", full: "Lundi" },
  { dayIndex: 2, short: "Mar", full: "Mardi" },
  { dayIndex: 3, short: "Mer", full: "Mercredi" },
  { dayIndex: 4, short: "Jeu", full: "Jeudi" },
  { dayIndex: 5, short: "Ven", full: "Vendredi" },
  { dayIndex: 6, short: "Sam", full: "Samedi" },
  { dayIndex: 0, short: "Dim", full: "Dimanche" },
] as const;
