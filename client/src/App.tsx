import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
// Login e Home ficam no bundle principal (primeira tela); o resto é carregado
// sob demanda por rota (code-splitting) para reduzir o carregamento inicial.
import Home from "./pages/Home";
import Login from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";
import { Spinner } from "./components/ui/spinner";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ObrasList = lazy(() => import("./pages/ObrasList"));
const ObraEdit = lazy(() => import("./pages/ObraEdit"));
const EquipesManagement = lazy(() => import("./pages/EquipesManagement"));
const Colaboradores = lazy(() => import("./pages/Colaboradores"));
const ObraDetail = lazy(() => import("./pages/ObraDetail"));
const DiarioView = lazy(() => import("./pages/DiarioView"));
const ResumosPeriodicos = lazy(() => import("./pages/ResumosPeriodicos"));
const ResumosHub = lazy(() => import("./pages/ResumosHub"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const Planejamento = lazy(() => import("./pages/Planejamento"));
const DiarioEdit = lazy(() => import("./pages/DiarioEdit"));
const ClientObras = lazy(() => import("./pages/ClientObras"));
const ClientPanel = lazy(() => import("./pages/ClientPanel"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Cronograma = lazy(() => import("./pages/Cronograma"));
const Presenca = lazy(() => import("./pages/Presenca"));
const ConfiguracaoEmpresa = lazy(() => import("./pages/ConfiguracaoEmpresa"));
const CategoriasInsumo = lazy(() => import("./pages/CategoriasInsumo"));
const Insumos = lazy(() => import("./pages/Insumos"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const AprovacaoPedidos = lazy(() => import("./pages/AprovacaoPedidos"));
const MapaCotacaoGlobal = lazy(() => import("./pages/MapaCotacaoGlobal"));
const OrdensCompra = lazy(() => import("./pages/OrdensCompra"));

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route component={Home} />
      </Switch>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spinner /></div>}>
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/?"}  component={Dashboard} />
      <Route path={"/obras"} component={ObrasList} />
      <Route path={"/obras/:id"} component={ObraDetail} />
      <Route path={"/obras/:id/edit"} component={ObraEdit} />
      <Route path={"/obras/:obraId/diario/:diarioId"} component={DiarioView} />
      <Route path={"/obras/:obraId/diario/:diarioId/edit"} component={DiarioEdit} />
      <Route path={"/resumos"} component={ResumosHub} />
      <Route path={"/orcamentos"} component={Orcamentos} />
      <Route path={"/planejamento"} component={Planejamento} />
      <Route path={"/obras/:obraId/resumos"} component={ResumosPeriodicos} />
      <Route path={"/relatorios/:obraId"} component={Relatorios} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/equipes"} component={EquipesManagement} />
      <Route path={"/colaboradores"} component={Colaboradores} />
      <Route path={"/obras/:obraId/cronograma"} component={Cronograma} />
      <Route path={"/obras/:obraId/presenca"} component={Presenca} />
      <Route path={"/client"} component={ClientObras} />
      <Route path={"/client/obras/:id"} component={ClientPanel} />
      <Route path={"/configuracoes/empresa"} component={ConfiguracaoEmpresa} />
      <Route path={"/cadastros/categorias-insumo"} component={CategoriasInsumo} />
      <Route path={"/cadastros/insumos"} component={Insumos} />
      <Route path={"/cadastros/fornecedores"} component={Fornecedores} />
      <Route path={"/suprimentos/aprovacao"} component={AprovacaoPedidos} />
      <Route path={"/suprimentos/cotacao"} component={MapaCotacaoGlobal} />
      <Route path={"/suprimentos/ordens"} component={OrdensCompra} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
