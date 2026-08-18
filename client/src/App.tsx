/** 设计提醒：雾面硬件主义。应用入口应保持克制，桌面本身才是第一界面。 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [desktopRecoveryEpoch, setDesktopRecoveryEpoch] = useState(0);
  return (
    <ErrorBoundary onRecover={() => setDesktopRecoveryEpoch((value) => value + 1)}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router key={desktopRecoveryEpoch} />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
import { useState } from "react";
