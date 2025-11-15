import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacePage } from './pages/WorkspacePage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>DevNote - トップページ（認証機能は別タスクで実装）</div>} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workspace/:id" element={<WorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
