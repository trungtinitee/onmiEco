import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import WastewaterPretreatment from './pages/WastewaterPretreatment';
import WastewaterBiology from './pages/WastewaterBiology';
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

export default function App() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const routerBase = baseUrl.startsWith('/') ? baseUrl : '/';

  return (
    <AppProvider>
      <BrowserRouter basename={routerBase}>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tien-xu-ly" element={<WastewaterPretreatment />} />
            <Route path="/hoa-ly" element={<PhysicochemicalCalc />} />
            <Route path="/sinh-hoc" element={<WastewaterBiology />} />
            <Route path="/bun-khu-trung" element={<WastewaterSludge />} />
            <Route path="/cap-nuoc" element={<WaterSupplyBasic />} />
            <Route path="/cap-nuoc-nang-cao" element={<WaterSupplyAdvanced />} />
            <Route path="/khi-thai" element={<AirEmissionsCalc />} />
            <Route path="/chat-thai-ran" element={<SolidWasteCalc />} />
            <Route path="/mep-thuy-luc" element={<MEPHydraulics />} />
            <Route path="/dien-may-thoi-khi" element={<ElectricalCalc />} />
            <Route path="/van-hanh" element={<OperationsCalc />} />
            <Route path="/nhat-ky-van-hanh" element={<DailyOperationLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
