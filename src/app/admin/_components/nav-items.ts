// `scope: null` = visible para cualquiera de los 3 roles admin.
// "comercios"/"blackfit" = solo visible si ese admin recortado (o el
// general) tiene ese scope — ver puedeComercios/puedeBlackfit en
// admin/layout.tsx.
export const NAV_ITEMS_ADMIN = [
  { href: "/admin", label: "Inicio", icon: "home", scope: null },
  { href: "/admin/usuarios", label: "Usuarios", icon: "group", scope: null },
  { href: "/admin/planes", label: "Planes", icon: "card_membership", scope: "blackfit" },
  { href: "/admin/comercios", label: "Comercios", icon: "storefront", scope: "comercios" },
] as const;
