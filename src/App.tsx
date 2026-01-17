import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import Catalog from "./pages/Catalog";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Events from "./pages/Events";
import Kitchen from "./pages/Kitchen";
import Bartender from "./pages/Bartender";
import MyOrders from "./pages/MyOrders";
import MyHistory from "./pages/MyHistory";
import CashRegister from "./pages/CashRegister";
import CashierCollect from "./pages/CashierCollect";
import StaffHistory from "./pages/StaffHistory";
import Staff from "./pages/Staff";
import InternalConsumption from "./pages/InternalConsumption";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/kitchen" element={<ProtectedRoute><Kitchen /></ProtectedRoute>} />
            <Route path="/bartender" element={<ProtectedRoute><Bartender /></ProtectedRoute>} />
            <Route path="/my-orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
            <Route path="/my-history" element={<ProtectedRoute><MyHistory /></ProtectedRoute>} />
            <Route path="/cash-register" element={<ProtectedRoute><CashRegister /></ProtectedRoute>} />
            <Route path="/cashier-collect" element={<ProtectedRoute><CashierCollect /></ProtectedRoute>} />
            <Route path="/staff-history" element={<ProtectedRoute><StaffHistory /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
            <Route path="/internal-consumption" element={<ProtectedRoute><InternalConsumption /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
