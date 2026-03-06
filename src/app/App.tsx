import { Routes, Route, useLocation } from "react-router-dom";
import { routes } from "./routes";
import Layout from "../components/Layout/Layout";
// import InstallBanner from "../components/InstallBanner/InstallBanner";

const NO_LAYOUT_PREFIXES = ["/login", "/register"];

export default function App() {
    const { pathname } = useLocation();
    const noLayout = NO_LAYOUT_PREFIXES.some((p) => pathname.startsWith(p));

    const content = (
        <>
            <Routes>
                {routes.map((r) => (
                    <Route key={r.path} path={r.path} element={r.element} />
                ))}
            </Routes>
        </>
    );

    return (
        <>
            {noLayout ? content : <Layout>{content}</Layout>}
            {/* <InstallBanner /> */}
        </>
    );
}
