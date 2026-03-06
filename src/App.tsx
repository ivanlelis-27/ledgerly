import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard/Dashboard";
import AddExpense from "./pages/AddExpense/AddExpense";
import Recurring from "./pages/Recurring/Recurring";
import Savings from "./pages/Savings/Savings";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* app pages (no auth guard yet) */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/add" element={<AddExpense />} />
      <Route path="/recurring" element={<Recurring />} />
      <Route path="/savings" element={<Savings />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
