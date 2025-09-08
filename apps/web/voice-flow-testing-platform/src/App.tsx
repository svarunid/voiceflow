import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PersonasTab from './components/PersonasTab';
import TestsTab from './components/TestsTab';
import PersonaDetail from './components/PersonaDetail';
import TestDetail from './components/TestDetail';
import LiveTesting from './components/LiveTesting';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PersonasTab />} />
          <Route path="personas" element={<PersonasTab />} />
          <Route path="personas/:id" element={<PersonaDetail />} />
          <Route path="tests" element={<TestsTab />} />
          <Route path="tests/:id" element={<TestDetail />} />
          <Route path="live-test/:personaId" element={<LiveTesting />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
