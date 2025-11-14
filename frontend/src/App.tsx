import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorkspacePage } from './pages/WorkspacePage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>DevNote - トップページ（タスク 11.1-11.5 で実装）</div>} />
        <Route path="/dashboard" element={<div>ダッシュボード（タスク 11.1-11.5 で実装）</div>} />
        <Route path="/workspace/:id" element={<WorkspacePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
