import { memo, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Dashboard from './pages/Dashboard';
import WastewaterInput from './pages/WastewaterInput';
import WastewaterPretreatment from './pages/WastewaterPretreatment';
import WastewaterBiology from './pages/WastewaterBiology';
import WastewaterTertiary from './pages/WastewaterTertiary';
import WastewaterSludge from './pages/WastewaterSludge';
import PhysicochemicalCalc from './pages/PhysicochemicalCalc';
import WaterSupplyBasic from './pages/WaterSupplyBasic';
import WaterSupplyAdvanced from './pages/WaterSupplyAdvanced';
import AirEmissionsCalc from './pages/AirEmissionsCalc';
import SolidWasteCalc from './pages/SolidWasteCalc';
import MEPHydraulics from './pages/MEPHydraulics';
import ElectricalCalc from './pages/ElectricalCalc';
import OperationsCalc from './pages/OperationsCalc';
import DailyOperationLog from './pages/DailyOperationLog';
import BioDiagnostics from './pages/BioDiagnostics';
import EquipmentDBManager from './components/EquipmentDBManager';
import ProcurementList from './components/ProcurementList';

const AppRoutes = memo(function AppRoutes() {
  return (
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
  );
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
          <AppRoutes />
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
