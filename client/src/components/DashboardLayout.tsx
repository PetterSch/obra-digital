import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, Building2, FileText, UserCog, Calculator, ClipboardList, Tags, Package, Truck, Map, ShoppingBag, ChevronDown, Menu } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { trpc } from "@/lib/trpc";
import { setPDFConfig } from "@/lib/pdfExport";
import { Button } from "./ui/button";

type MenuItem = { icon: any; label: string; path: string; adminOnly?: boolean; count?: "obras" | "orcamentos" | "planejamentos"; disabled?: boolean };
type MenuGroup = { label: string; items: MenuItem[] };

const menuGroups: MenuGroup[] = [
  { label: "Principal", items: [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Building2,       label: "Obras",     path: "/obras", count: "obras" },
  ]},
  { label: "Gestão", items: [
    { icon: Calculator,    label: "Orçamentos",   path: "/orcamentos", count: "orcamentos" },
    { icon: ClipboardList, label: "Planejamento", path: "/planejamento", count: "planejamentos" },
    { icon: FileText,      label: "Resumos",      path: "/resumos" },
  ]},
  { label: "Suprimentos", items: [
    { icon: Truck,      label: "Aprovação de Pedidos", path: "/suprimentos/aprovacao" },
    { icon: Map,        label: "Mapa de Cotação",      path: "/suprimentos/cotacao" },
    { icon: ShoppingBag,label: "Ordens de Compra",     path: "/suprimentos/ordens" },
  ]},
  { label: "Cadastros", items: [
    { icon: Building2, label: "Minha Empresa",          path: "/configuracoes/empresa", adminOnly: true },
    { icon: Tags,      label: "Categorias de Insumos",  path: "/cadastros/categorias-insumo" },
    { icon: Package,   label: "Insumos",                path: "/cadastros/insumos" },
    { icon: Truck,     label: "Fornecedores",           path: "/cadastros/fornecedores" },
    { icon: UserCog,   label: "Usuários",               path: "/admin", adminOnly: true },
  ]},
];

const allMenuItems: MenuItem[] = menuGroups.flatMap(g => g.items);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  // Sincroniza a config da empresa (servidor → local) para os PDFs de todos os usuários
  const { data: empresaConfig } = trpc.empresa.get.useQuery(undefined, { enabled: !!user });
  useEffect(() => {
    if (empresaConfig && typeof empresaConfig === "object") {
      setPDFConfig(empresaConfig as any);
    }
  }, [empresaConfig]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const isMobile = useIsMobile();

  // Contadores para os badges do menu
  const { data: obrasC = [] } = trpc.obras.list.useQuery(undefined, { enabled: !!user });
  const { data: orcsC = [] } = trpc.orcamentos.list.useQuery(undefined, { enabled: !!user });
  const { data: plansC = [] } = trpc.planejamento.list.useQuery(undefined, { enabled: !!user });
  const counts: Record<string, number> = {
    obras: (obrasC as any[]).length,
    orcamentos: (orcsC as any[]).length,
    planejamentos: (plansC as any[]).length,
  };

  const visibleGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(item => !item.adminOnly || isAdmin) }))
    .filter(g => g.items.length > 0);

  const go = (item: MenuItem) => { if (!item.disabled) setLocation(item.path); };

  const renderItemInner = (item: MenuItem) => {
    const isActive = location === item.path;
    const count = item.count ? counts[item.count] : undefined;
    return (
      <>
        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        <span className="flex-1">{item.label}</span>
        {item.disabled && (
          <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">em breve</span>
        )}
        {!item.disabled && count != null && count > 0 && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{count}</span>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Barra de menu superior ── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Marca */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 shrink-0 pr-2 focus:outline-none"
          >
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight hidden sm:inline">Obra Digital</span>
          </button>

          {/* Menus (desktop) */}
          {!isMobile ? (
            <nav className="flex items-center gap-0.5">
              {visibleGroups.map(group => {
                const groupActive = group.items.some(i => i.path === location);
                return (
                  <DropdownMenu key={group.label}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`inline-flex items-center gap-1 rounded-md px-3 h-9 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent ${
                          groupActive ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {group.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-60">
                      {group.items.map(item => (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => go(item)}
                          disabled={item.disabled}
                          className={`gap-2 cursor-pointer ${location === item.path ? "bg-accent" : ""}`}
                        >
                          {renderItemInner(item)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </nav>
          ) : (
            /* Menu único (mobile) */
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 rounded-md px-3 h-9 text-sm font-medium hover:bg-accent focus:outline-none">
                  <Menu className="h-4 w-4" /> Menu
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-[80vh] overflow-y-auto">
                {visibleGroups.map((group, gi) => (
                  <div key={group.label}>
                    {gi > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {group.label}
                    </DropdownMenuLabel>
                    {group.items.map(item => (
                      <DropdownMenuItem
                        key={item.path}
                        onClick={() => go(item)}
                        disabled={item.disabled}
                        className={`gap-2 cursor-pointer ${location === item.path ? "bg-accent" : ""}`}
                      >
                        {renderItemInner(item)}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Direita: tema + usuário */}
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left min-w-0 max-w-[160px]">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="md:hidden">
                  <p className="text-sm font-medium truncate">{user?.name || "-"}</p>
                  <p className="text-xs text-muted-foreground truncate font-normal">{user?.email || "-"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="md:hidden" />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}

// Compat: mantém a referência usada por telas que importam allMenuItems (se houver)
export { allMenuItems };
