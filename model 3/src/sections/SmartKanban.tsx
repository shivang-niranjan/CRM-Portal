/**
 * Smart Kanban Board Component
 * Drag-and-drop ticket management with SLA timers
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  MessageSquare,
  Facebook,
  Instagram,
  Phone
} from 'lucide-react';
import type { KanbanColumn, Ticket } from '@/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SmartKanbanProps {
  onTicketClick?: (ticket: Ticket) => void;
}

// SLA Timer Component
function SLATimer({ 
  deadline, 
  breached,
  timeRemainingHours 
}: { 
  deadline: string; 
  breached: boolean;
  timeRemainingHours: number;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [progress, setProgress] = useState<number>(100);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diff = deadlineDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('BREACHED');
        setProgress(0);
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m`);
      }
      
      // Calculate progress (assuming 48h SLA)
      const totalHours = 48;
      const remainingProgress = Math.max(0, (timeRemainingHours / totalHours) * 100);
      setProgress(remainingProgress);
    };
    
    calculateTime();
    const interval = setInterval(calculateTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [deadline, timeRemainingHours]);

  if (breached) {
    return (
      <div className="flex items-center gap-1 text-red-400">
        <AlertTriangle className="w-3 h-3" />
        <span className="text-xs font-semibold">SLA BREACHED</span>
      </div>
    );
  }

  const getProgressColor = () => {
    if (progress < 20) return 'bg-red-500';
    if (progress < 50) return 'bg-orange-500';
    if (progress < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">SLA:</span>
        <span className={progress < 20 ? 'text-red-400 font-semibold' : 'text-slate-300'}>
          {timeLeft}
        </span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${getProgressColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Ticket Card Component
function TicketCard({ 
  ticket, 
  onClick 
}: { 
  ticket: Ticket; 
  onClick?: (ticket: Ticket) => void;
}) {
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

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'electricity':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'water':
        return 'text-blue-500 bg-blue-500/10';
      case 'roads':
        return 'text-gray-500 bg-gray-500/10';
      case 'sanitation':
        return 'text-green-500 bg-green-500/10';
      default:
        return 'text-slate-500 bg-slate-500/10';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'whatsapp':
        return <MessageSquare className="w-3 h-3 text-green-500" />;
      case 'facebook':
        return <Facebook className="w-3 h-3 text-blue-500" />;
      case 'instagram':
        return <Instagram className="w-3 h-3 text-pink-500" />;
      case 'voice':
        return <Phone className="w-3 h-3 text-purple-500" />;
      default:
        return <RefreshCw className="w-3 h-3 text-slate-500" />;
    }
  };

  const getUrgencyDots = (score: number) => {
    const dots = [];
    const filledDots = Math.ceil(score / 2);
    
    for (let i = 0; i < 5; i++) {
      dots.push(
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < filledDots 
              ? score >= 8 ? 'bg-red-500' 
                : score >= 6 ? 'bg-orange-500' 
                : score >= 4 ? 'bg-yellow-500' 
                : 'bg-green-500'
              : 'bg-slate-700'
          }`}
        />
      );
    }
    return dots;
  };

  return (
    <div
      onClick={() => onClick?.(ticket)}
      className={`
        p-3 bg-slate-800/50 rounded-lg cursor-pointer 
        hover:bg-slate-800 transition-all duration-200
        border border-transparent hover:border-slate-700
        ${ticket.sla_breached ? 'border-red-500/30 bg-red-500/5' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
          {getSourceIcon(ticket.source)}
        </div>
        <Badge 
          variant="outline" 
          className={`text-xs ${getPriorityColor(ticket.priority)}`}
        >
          {ticket.priority}
        </Badge>
      </div>

      {/* Category */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(ticket.category)}`}>
          {ticket.category}
        </span>
        {ticket.report_count > 1 && (
          <Badge variant="secondary" className="text-xs">
            {ticket.report_count} reports
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 line-clamp-2 mb-3">
        {ticket.description}
      </p>

      {/* Urgency Score */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-500">Urgency:</span>
        <div className="flex gap-0.5">
          {getUrgencyDots(ticket.urgency_score)}
        </div>
        <span className="text-xs text-slate-400">{ticket.urgency_score.toFixed(1)}/10</span>
      </div>

      {/* SLA Timer */}
      {ticket.sla_deadline && (
        <div className="mb-3">
          <SLATimer 
            deadline={ticket.sla_deadline}
            breached={ticket.sla_breached}
            timeRemainingHours={ticket.time_remaining_hours}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {ticket.assigned_department && (
            <Badge variant="outline" className="text-[10px] py-0 px-1 border-slate-700 text-slate-400">
              {ticket.assigned_department}
            </Badge>
          )}
        </div>
      </div>

      {/* Verification Status */}
      {ticket.verification_status !== 'pending' && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${
          ticket.verification_status === 'passed' 
            ? 'text-green-400' 
            : 'text-red-400'
        }`}>
          {ticket.verification_status === 'passed' ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          <span className="capitalize">{ticket.verification_status}</span>
        </div>
      )}
    </div>
  );
}

// Kanban Column Component
function KanbanColumnComponent({
  column,
  onTicketClick
}: {
  column: KanbanColumn;
  onTicketClick?: (ticket: Ticket) => void;
}) {
  const getColumnColor = (status: string) => {
    switch (status) {
      case 'reported':
        return 'border-slate-600';
      case 'clustered':
        return 'border-blue-600';
      case 'assigned':
        return 'border-purple-600';
      case 'in_progress':
        return 'border-yellow-600';
      case 'on_site':
        return 'border-orange-600';
      case 'resolved':
        return 'border-green-600';
      default:
        return 'border-slate-600';
    }
  };

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={`bg-slate-900 border-t-4 ${getColumnColor(column.id)} h-full`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-200">
              {column.title}
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {column.count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {column.tickets.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No tickets</p>
            </div>
          ) : (
            column.tickets.map((ticket) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket} 
                onClick={onTicketClick}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SmartKanban({ onTicketClick }: SmartKanbanProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchKanbanData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getKanbanBoard();
      setColumns(data.columns);
      setLastUpdated(data.last_updated);
    } catch (error) {
      console.error('Failed to fetch kanban data:', error);
      toast.error('Failed to fetch kanban board');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKanbanData();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchKanbanData, 10000);
    return () => clearInterval(interval);
  }, [fetchKanbanData]);

  const totalTickets = columns.reduce((sum, col) => sum + col.count, 0);
  const slaBreachedCount = columns.reduce(
    (sum, col) => sum + col.tickets.filter(t => t.sla_breached).length, 
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Smart Kanban Board</h2>
                <p className="text-sm text-slate-400">
                  {totalTickets} active tickets • {slaBreachedCount} SLA breaches
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-slate-500">
                  Last updated: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={fetchKanbanData}
                disabled={isLoading}
                className="border-slate-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="relative">
        {isLoading && columns.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <KanbanColumnComponent
                key={column.id}
                column={column}
                onTicketClick={onTicketClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-400">Board Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-600"></div>
              <span className="text-slate-300">Reported</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600"></div>
              <span className="text-slate-300">Clustered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-600"></div>
              <span className="text-slate-300">Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
              <span className="text-slate-300">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-600"></div>
              <span className="text-slate-300">On Site</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              <span className="text-slate-300">Resolved</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
