import { Suspense, lazy, memo, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import EquipmentDBManager from './components/EquipmentDBManager';
import ProcurementList from './components/ProcurementList';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const WastewaterInput = lazy(() => import('./pages/WastewaterInput'));
const WastewaterPretreatment = lazy(() => import('./pages/WastewaterPretreatment'));
const WastewaterBiology = lazy(() => import('./pages/WastewaterBiology'));
const WastewaterTertiary = lazy(() => import('./pages/WastewaterTertiary'));
const WastewaterSludge = lazy(() => import('./pages/WastewaterSludge'));
const PhysicochemicalCalc = lazy(() => import('./pages/PhysicochemicalCalc'));
const WaterSupplyBasic = lazy(() => import('./pages/WaterSupplyBasic'));
const WaterSupplyAdvanced = lazy(() => import('./pages/WaterSupplyAdvanced'));
const AirEmissionsCalc = lazy(() => import('./pages/AirEmissionsCalc'));
const SolidWasteCalc = lazy(() => import('./pages/SolidWasteCalc'));
const MEPHydraulics = lazy(() => import('./pages/MEPHydraulics'));
const ElectricalCalc = lazy(() => import('./pages/ElectricalCalc'));
const OperationsCalc = lazy(() => import('./pages/OperationsCalc'));
const DailyOperationLog = lazy(() => import('./pages/DailyOperationLog'));
const BioDiagnostics = lazy(() => import('./pages/BioDiagnostics'));

function RouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center p-6">
      <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-3 text-sm text-slate-300 shadow-lg">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400"
        />
        <span>Đang tải phân hệ...</span>
      </div>
    </div>
  );
}

const AppRoutes = memo(function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/thong-so-dau-vao" element={<WastewaterInput />} />
        <Route path="/tien-xu-ly" element={<WastewaterPretreatment />} />
        <Route path="/hoa-ly" element={<PhysicochemicalCalc />} />
        <Route path="/sinh-hoc" element={<WastewaterBiology />} />
        <Route path="/hoan-thien-khu-trung" element={<WastewaterTertiary />} />
        <Route path="/xu-ly-bun" element={<WastewaterSludge />} />
        <Route
          path="/bun-khu-trung"
          element={<Navigate to="/xu-ly-bun" replace />}
        />
        <Route path="/cap-nuoc" element={<WaterSupplyBasic />} />
        <Route path="/cap-nuoc-nang-cao" element={<WaterSupplyAdvanced />} />
        <Route path="/khi-thai" element={<AirEmissionsCalc />} />
        <Route path="/chat-thai-ran" element={<SolidWasteCalc />} />
        <Route path="/mep-thuy-luc" element={<MEPHydraulics />} />
        <Route path="/dien-may-thoi-khi" element={<ElectricalCalc />} />
        <Route path="/van-hanh" element={<OperationsCalc />} />
        <Route path="/nhat-ky-van-hanh" element={<DailyOperationLog />} />
        <Route path="/chan-doan-sinh-hoc" element={<BioDiagnostics />} />
        <Route path="/kho-thiet-bi" element={<EquipmentDBManager />} />
        <Route path="/mua-sam" element={<ProcurementList />} />
        <Route path="/bom" element={<Navigate to="/mua-sam" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
});

const ProjectScopedRoutes = memo(function ProjectScopedRoutes() {
  const { currentProjectId, currentProject, projectDataRevision } =
    useAppContext();
  const activeKey = `${
    currentProjectId || currentProject?.id || 'default-project'
  }-rev${projectDataRevision || 0}`;
  return <AppRoutes key={activeKey} />;
});

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    let hideTimer;
    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
      hideTimer = window.setTimeout(() => {
        setIsLoading(false);
      }, 450);
    }, 1600);

    return () => {
      window.clearTimeout(fadeTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  const baseUrl = import.meta.env.BASE_URL || '/';
  const routerBase = baseUrl.startsWith('/') ? baseUrl : '/';

  return (
    <AppProvider>
      {isLoading && <SplashScreen isFadingOut={isFadingOut} />}
      <BrowserRouter basename={routerBase}>
        <Layout>
          <ProjectScopedRoutes />
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
