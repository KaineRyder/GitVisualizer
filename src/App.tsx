import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { AnalysisPage } from './pages/AnalysisPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/analyze" element={<AnalysisPage />} />
      </Routes>
    </Router>
  );
}
