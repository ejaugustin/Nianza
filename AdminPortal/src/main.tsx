import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { DashboardPage } from "./pages/dashboard";
import { ContentPage } from "./pages/content";
import { LoginPage } from "./pages/login";
import { UsersPage } from "./pages/users";
import { SubscriptionsPage } from "./pages/subscriptions";
import { NotificationsPage } from "./pages/notifications";
import { EngagementPage } from "./pages/engagement";
import { SystemHealthPage } from "./pages/system-health";
import { DataExportsPage } from "./pages/data-exports";
import { SettingsPage } from "./pages/settings";
import nianzaLogo from "./assets/nianza-logo-reversed.svg";
import "./styles/global.css";

const queryClient = new QueryClient();

function AdminShell() {
  const { isAuthenticated, session, signOut } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand"><img src={nianzaLogo} alt="Nianza Admin" className="brand-logo" /></div>
          <nav>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/content">Content</NavLink>
            <NavLink to="/users">Users</NavLink>
            <NavLink to="/subscriptions">Subscriptions</NavLink>
            <NavLink to="/notifications">Notifications</NavLink>
            <NavLink to="/engagement">Engagement</NavLink>
            <NavLink to="/system-health">System Health</NavLink>
            <NavLink to="/data-exports">Data Exports</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <div className="admin-profile">
            <div>{session?.user.email}</div>
            <span>{session?.user.role}</span>
            <button className="button-secondary sidebar-button" onClick={signOut} type="button">Sign out</button>
          </div>
        </aside>
        <main className="main-panel">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/content" element={<ContentPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/engagement" element={<EngagementPage />} />
            <Route path="/system-health" element={<SystemHealthPage />} />
            <Route path="/data-exports" element={<DataExportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
