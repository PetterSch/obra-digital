import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ObrasList from "./pages/ObrasList";
import ObraEdit from "./pages/ObraEdit";
import EquipesManagement from "./pages/EquipesManagement";
import Colaboradores from "./pages/Colaboradores";
import ObraDetail from "./pages/ObraDetail";
import DiarioObra from "./pages/DiarioObra";
import DiarioView from "./pages/DiarioView";
import ResumosPeriodicos from "./pages/ResumosPeriodicos";
import ResumosHub from "./pages/ResumosHub";
import Orcamentos from "./pages/Orcamentos";
import Planejamento from "./pages/Planejamento";
import DiarioEdit from "./pages/DiarioEdit";
import ClientObras from "./pages/ClientObras";
import ClientPanel from "./pages/ClientPanel";
import Relatorios from "./pages/Relatorios";
import AdminPanel from "./pages/AdminPanel";
import Cronograma from "./pages/Cronograma";
import Presenca from "./pages/Presenca";
import ConfiguracaoEmpresa from "./pages/ConfiguracaoEmpresa";
import CategoriasInsumo from "./pages/CategoriasInsumo";
import Insumos from "./pages/Insumos";
import { useAuth } from "./_core/hooks/useAuth";
import { Spinner } from "./components/ui/spinner";

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
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
