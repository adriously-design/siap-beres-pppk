import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient();

const AppWrapper = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

describe("App", () => {
    it("renders without crashing", () => {
        render(<AppWrapper />);
        // Basic check to see if something renders. 
        // Adjust based on your actual App content, e.g., checking for a specific text or element.
        // For now, we just ensure render doesn't throw.
        expect(document.body).toBeInTheDocument();
    });
});
