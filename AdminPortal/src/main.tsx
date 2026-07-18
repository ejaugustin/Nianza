import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard";
import { ContentPage } from "./pages/content";
import { UsersPage } from "./pages/users";
import { SettingsPage } from "./pages/settings";
import "./styles/global.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
