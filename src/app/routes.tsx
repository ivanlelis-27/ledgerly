import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import RequireAuth from "../components/Auth/RequireAuth";

import Dashboard from "../pages/Dashboard/Dashboard";
import AddExpense from "../pages/AddExpense/AddExpense";
import Recurring from "../pages/Recurring/Recurring";
import Savings from "../pages/Savings/Savings";
import Simulator from "../pages/Simulator/Simulator";
import Health from "../pages/Health/Health";
import Login from "../pages/Login/Login";
import Register from "../pages/Register/Register";
import Settings from "../pages/Settings/Settings";
import Salary from "../pages/Salary/Salary";
import Profile from "../pages/Profile/Profile.tsx";
import Advisor from "../pages/Advisor/Advisor";

export type AppRoute = {
    path: string;
    element: ReactNode;
};

export const routes: AppRoute[] = [
    // entry
    { path: "/", element: <Navigate to="/dashboard" replace /> },

    // public
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },

    // protected
    {
        path: "/dashboard",
        element: (
            <RequireAuth>
                <Dashboard />
            </RequireAuth>
        ),
    },
    {
        path: "/add",
        element: (
            <RequireAuth>
                <AddExpense />
            </RequireAuth>
        ),
    },
    {
        path: "/recurring",
        element: (
            <RequireAuth>
                <Recurring />
            </RequireAuth>
        ),
    },
    {
        path: "/savings",
        element: (
            <RequireAuth>
                <Savings />
            </RequireAuth>
        ),
    },
    {
        path: "/simulator",
        element: (
            <RequireAuth>
                <Simulator />
            </RequireAuth>
        ),
    },
    {
        path: "/health",
        element: (
            <RequireAuth>
                <Health />
            </RequireAuth>
        ),
    },
    {
        path: "/salary",
        element: (
            <RequireAuth>
                <Salary />
            </RequireAuth>
        ),
    },
    {
        path: "/advisor",
        element: (
            <RequireAuth>
                <Advisor />
            </RequireAuth>
        ),
    },
    {
        path: "/profile",
        element: (
            <RequireAuth>
                <Profile />
            </RequireAuth>
        ),
    },
    {
        path: "/settings",
        element: (
            <RequireAuth>
                <Settings />
            </RequireAuth>
        ),
    },

    // fallback
    { path: "*", element: <Navigate to="/dashboard" replace /> },
];
