/**
 * Dashboard Stats Component
 * Overview statistics and key metrics for the command center
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Droplets, 
  Trash2, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Activity
} from 'lucide-react';
import type { DashboardStats as DashboardStatsType, Ticket } from '@/types';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface DashboardStatsProps {
  stats: DashboardStatsType | null;
  onTicketClick?: (ticket: Ticket) => void;
}

export default function DashboardStats({ stats, onTicketClick }: DashboardStatsProps) {
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const fetchRecentTickets = async () => {
      try {
        const tickets = await api.getTickets({ limit: 5 });
        setRecentTickets(tickets);
      } catch (error) {
        console.error('Failed to fetch recent tickets:', error);
      }
    };
    
    fetchRecentTickets();
    
    // Poll for recent tickets every 10 seconds
    const interval = setInterval(fetchRecentTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'electricity':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'water':
        return <Droplets className="w-5 h-5 text-blue-500" />;
      case 'roads':
        return <div className="w-5 h-5 bg-gray-500 rounded-sm" />;
      case 'sanitation':
        return <Trash2 className="w-5 h-5 text-green-500" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'verified':
      case 'closed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
      case 'on_site':
        return 'bg-blue-500/20 text-blue-400';
      case 'escalated':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Tickets */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Active Tickets</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats.total_active_tickets}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
              <span className="text-green-400">+{stats.today_reports}</span>
              <span className="text-slate-500 ml-1">today</span>
            </div>
          </CardContent>
        </Card>

        {/* SLA Breaches */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">SLA Breaches</p>
                <p className={`text-3xl font-bold mt-1 ${
                  stats.sla_breach_count > 0 ? 'text-red-400' : 'text-green-400'
                }`}>
                  {stats.sla_breach_count}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                stats.sla_breach_count > 0 ? 'bg-red-500/20' : 'bg-green-500/20'
              }`}>
                <Clock className={`w-6 h-6 ${
                  stats.sla_breach_count > 0 ? 'text-red-500' : 'text-green-500'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Time */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Resolution</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {Math.round(stats.avg_resolution_time)}h
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-500">Target: 48h</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Reports */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Today's Reports</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats.today_reports}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-500">New complaints today</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown & Recent Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tickets by Category */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Tickets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.tickets_by_category).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getCategoryIcon(category)}
                    <span className="text-slate-300 capitalize">{category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ 
                          width: `${Math.min((count / stats.total_active_tickets) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-slate-400 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Tickets */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Recent Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <div 
                  key={ticket.id}
                  onClick={() => onTicketClick?.(ticket)}
                  className="p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(ticket.category)}
                      <span className="font-medium text-slate-200 text-sm">
                        {ticket.ticket_number}
                      </span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getPriorityColor(ticket.priority)}`}
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-sm mt-2 line-clamp-1">
                    {ticket.description}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getStatusColor(ticket.status)}`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(stats.tickets_by_status).map(([status, count]) => (
              <div 
                key={status}
                className="p-4 bg-slate-800/50 rounded-lg text-center"
              >
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-slate-400 capitalize mt-1">
                  {status.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
