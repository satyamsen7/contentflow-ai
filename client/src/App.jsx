import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout      from './components/Layout';
import Dashboard   from './pages/Dashboard';
import Topics      from './pages/Topics';
import Schedule    from './pages/Schedule';
import NewPost     from './pages/NewPost';
import Logs        from './pages/Logs';
import Credentials from './pages/Credentials';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"   element={<Dashboard />}   />
          <Route path="/topics"      element={<Topics />}      />
          <Route path="/schedule"    element={<Schedule />}    />
          <Route path="/new-post"    element={<NewPost />}     />
          <Route path="/logs"        element={<Logs />}        />
          <Route path="/credentials" element={<Credentials />} />
        </Route>
      </Routes>
    </Router>
  );
}
