import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { NotificationToast } from "@/components/NotificationToast";

createRoot(document.getElementById("root")!).render(
  <>
    <NotificationToast />
    <App />
  </>
);
