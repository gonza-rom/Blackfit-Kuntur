export const NAV_ITEMS_COACH = [
  { href: "/coach", label: "Inicio", shortLabel: "Inicio", icon: "home" },
  { href: "/coach/alumnos", label: "Alumnos", shortLabel: "Alumnos", icon: "groups" },
  {
    href: "/coach/programas/plantillas",
    label: "Programas",
    shortLabel: "Program.",
    icon: "content_copy",
  },
  {
    href: "/coach/ejercicios",
    label: "Ejercicios",
    shortLabel: "Ejerc.",
    icon: "fitness_center",
  },
  { href: "/coach/biblioteca", label: "Biblioteca", shortLabel: "Bibliot.", icon: "menu_book" },
  { href: "/coach/mensajes", label: "WhatsApp", shortLabel: "WhatsApp", icon: "forum" },
  { href: "/coach/perfil", label: "Perfil", shortLabel: "Perfil", icon: "person" },
] as const;
