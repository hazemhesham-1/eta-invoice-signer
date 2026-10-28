import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root");
if(!container) {
    throw new Error("Failed to find the root element. Make sure it exists in your index.html.");
}

const root = createRoot(container);
root.render(<App/>);