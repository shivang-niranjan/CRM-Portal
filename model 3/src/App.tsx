/**
 * Smart PS-CRM - React Frontend (Tri-Modular RBAC)
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { 
  Map, 
  Kanban, 
  Trophy, 
  AlertTriangle, 
  BarChart3,
  Activity,
  Zap,
  Droplets,
  Trash2,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

// Import components
import LiveMap from './sections/LiveMap';
import SmartKanban from './sections/SmartKanban';
import DepartmentLeaderboard from './sections/DepartmentLeaderboard';
import RedZoneHeatmap from './sections/RedZoneHeatmap';
import DashboardStats from './sections/DashboardStats';
import TicketDetailModal from './components/TicketDetailModal';

// Import Pages
import LoginPage from './pages/Login';
import CitizenDashboard from './pages/CitizenDashboard';
import WorkerView from './pages/WorkerView';

// Import Hooks & Context
import { useAuth } from './context/AuthContext';
import { Button } from '@/components/ui/button';

// Import types
import type { Ticket, DashboardStats as DashboardStatsType } from './types';

// Import API
import { api } from './lib/api';

function App() {
  const { user, logout, token } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStatsType | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch dashboard stats on mount (only for admin/worker)
  useEffect(() => {
    if (!token || (user?.role !== 'admin' && user?.role !== 'worker')) {
        setIsLoading(false);
        return;
    }

    const fetchDashboardStats = async () => {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        toast.error('Failed to fetch dashboard stats');
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 10000); 
    return () => clearInterval(interval);
  }, [token, user?.role, refreshKey]);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTicket(null);
  };

  const handleTicketUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'electricity': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'water': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'roads': return <div className="w-4 h-4 bg-gray-500 rounded-sm" />;
      case 'sanitation': return <Trash2 className="w-4 h-4 text-green-500" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  if (!user) {
    return <LoginPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-slate-400">Loading your view...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Smart PS-CRM
              </h1>
              <p className="text-xs text-slate-400">{user.role} Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-medium text-white flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-slate-400" /> {user.username}
                </span>
                <span className="text-[10px] text-blue-400 flex items-center gap-1">
                    <ShieldCheck className="w-2 h-2" /> {user.role} Verified
                </span>
            </div>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                className="text-slate-400 hover:text-white hover:bg-red-500/10"
            >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-7xl mx-auto">
        {user.role === 'citizen' && <CitizenDashboard />}
        {user.role === 'worker' && <WorkerView />}
        {user.role === 'admin' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
                <BarChart3 className="w-4 h-4 mr-2" /> Admin Dashboard
              </TabsTrigger>
              <TabsTrigger value="map" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
                <Map className="w-4 h-4 mr-2" /> Live Map
              </TabsTrigger>
              <TabsTrigger value="kanban" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
                <Kanban className="w-4 h-4 mr-2" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="heatmap" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
                <AlertTriangle className="w-4 h-4 mr-2" /> Red Zones
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300">
                <Trophy className="w-4 h-4 mr-2" /> Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <DashboardStats key={`dash-${refreshKey}`} stats={stats} onTicketClick={handleTicketClick} />
            </TabsContent>
            <TabsContent value="map" className="space-y-4">
              <LiveMap key={`map-${refreshKey}`} onTicketClick={handleTicketClick} />
            </TabsContent>
            <TabsContent value="kanban" className="space-y-4">
              <SmartKanban key={`kanban-${refreshKey}`} onTicketClick={handleTicketClick} />
            </TabsContent>
            <TabsContent value="heatmap" className="space-y-4">
              <RedZoneHeatmap key={`heatmap-${refreshKey}`} />
            </TabsContent>
            <TabsContent value="leaderboard" className="space-y-4">
              <DepartmentLeaderboard key={`leaderboard-${refreshKey}`} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        getCategoryIcon={getCategoryIcon}
        onUpdate={handleTicketUpdate}
      />
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}

export default App;
