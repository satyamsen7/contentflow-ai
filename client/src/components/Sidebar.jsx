import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileSpreadsheet, CalendarClock,
  FilePlus2, ScrollText, KeyRound, Zap
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard,  label: 'Dashboard'    },
  { to: '/topics',      icon: FileSpreadsheet,  label: 'Topics'       },
  { to: '/schedule',    icon: CalendarClock,    label: 'Schedule'     },
  { to: '/new-post',    icon: FilePlus2,        label: 'New Post'     },
  { to: '/logs',        icon: ScrollText,       label: 'Logs'         },
  { to: '/credentials', icon: KeyRound,         label: 'Credentials'  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <Zap size={18} color="var(--primary-lt)" />
          <h1>ContentFlow AI</h1>
        </div>
        <p>Instagram Automation</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={17} className="nav-icon" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="status-dot">
          <span className="dot" />
          Server running
        </div>
      </div>
    </aside>
  );
}
