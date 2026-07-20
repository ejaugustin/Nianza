import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { DashboardPage } from "./pages/dashboard";
import { ContentPage } from "./pages/content";
import { LoginPage } from "./pages/login";
import { UsersPage } from "./pages/users";
import { SettingsPage } from "./pages/settings";
import "./styles/global.css";

const queryClient = new QueryClient();

function AdminShell() {
  const { isAuthenticated, session, signOut } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">Nianza Admin</div>
          <nav>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/content">Content</NavLink>
            <NavLink to="/users">Users</NavLink>
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
