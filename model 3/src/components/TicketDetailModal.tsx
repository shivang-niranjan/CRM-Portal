/**
 * Ticket Detail Modal Component
 * Detailed view of a ticket with status updates and resolution
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  MapPin, 
  User, 
  Building2, 
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  History,
  X,
  Save,
  Loader2
} from 'lucide-react';
import type { Ticket, CitizenReport } from '@/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { formatDistanceToNow, format } from 'date-fns';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  getCategoryIcon: (category: string) => React.ReactNode;
  onUpdate?: () => void;
}

export default function TicketDetailModal({ 
  ticket, 
  isOpen, 
  onClose,
  getCategoryIcon,
  onUpdate
}: TicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [newStatus, setNewStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  useEffect(() => {
    if (ticket) {
      setNewStatus(ticket.status);
    }
  }, [ticket]);

  useEffect(() => {
    const fetchReports = async () => {
      if (ticket && isOpen && ticket.report_count > 1) {
        try {
          setIsLoadingReports(true);
          const data = await api.getTicketReports(ticket.id);
          setReports(data);
        } catch (error) {
          console.error("Failed to fetch sub-tickets:", error);
        } finally {
          setIsLoadingReports(false);
        }
      } else {
        setReports([]);
      }
    };
    fetchReports();
  }, [ticket, isOpen]);

  if (!ticket) return null;

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    
    try {
      setIsUpdating(true);
      await api.updateTicket(ticket.id, { status: newStatus });
      toast.success(`Ticket status updated to ${newStatus}`);
      onUpdate?.(); // Trigger global refresh
      onClose(); // Close modal on success to refresh data
    } catch (error) {
      console.error('Failed to update ticket status:', error);
      toast.error('Failed to update ticket status');
    } finally {
      setIsUpdating(false);
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

  const getUrgencyDots = (score: number) => {
    const dots = [];
    const filledDots = Math.ceil(score / 2);
    
    for (let i = 0; i < 5; i++) {
      dots.push(
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                {ticket.ticket_number}
                <Badge 
                  variant="outline" 
                  className={getPriorityColor(ticket.priority)}
                >
                  {ticket.priority}
                </Badge>
              </DialogTitle>
              <p className="text-sm text-slate-400 mt-1">
                Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="details" className="data-[state=active]:bg-slate-700">
              Details
            </TabsTrigger>
            <TabsTrigger value="location" className="data-[state=active]:bg-slate-700">
              Location
            </TabsTrigger>
            <TabsTrigger value="images" className="data-[state=active]:bg-slate-700">
              Images
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-slate-700">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Status & Category */}
            <div className="flex flex-wrap items-center gap-3">
              <Badge 
                variant="secondary" 
                className={getStatusColor(ticket.status)}
              >
                {ticket.status.replace('_', ' ')}
              </Badge>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full">
                {getCategoryIcon(ticket.category)}
                <span className="text-sm capitalize">{ticket.category}</span>
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full">
                <span className="text-sm text-slate-400">Source:</span>
                <span className="text-sm font-medium capitalize text-slate-200">{ticket.source || 'Unknown'}</span>
              </div>

              {ticket.report_count > 1 && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                  {ticket.report_count} reports clustered
                </Badge>
              )}
            </div>

            {/* Description */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Description</h4>
              <p className="text-slate-200">{ticket.description}</p>
            </div>

            {/* Clustered Reports */}
            {ticket.report_count > 1 && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Clustered Reports ({ticket.report_count})
                  </h4>
                  {isLoadingReports && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                </div>
                {reports.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {reports.map((report) => (
                      <div key={report.id} className="p-3 bg-slate-900 rounded border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-blue-400">
                            {report.citizen_name || 'Anonymous Citizen'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{report.description}</p>
                      </div>
                    ))}
                  </div>
                ) : !isLoadingReports && (
                  <p className="text-sm text-slate-500 text-center py-4 bg-slate-900 rounded">No sub-tickets available.</p>
                )}
              </div>
            )}

            {/* Urgency Score */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-400">Urgency Score</h4>
                <span className="text-lg font-bold text-white">{ticket.urgency_score.toFixed(1)}/10</span>
              </div>
              <div className="flex gap-1">
                {getUrgencyDots(ticket.urgency_score)}
              </div>
            </div>

            {/* SLA Information */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-400 mb-2">SLA Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">SLA Hours</p>
                  <p className="text-white">{ticket.sla_hours} hours</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Deadline</p>
                  <p className={ticket.sla_breached ? 'text-red-400' : 'text-white'}>
                    {ticket.sla_deadline 
                      ? format(new Date(ticket.sla_deadline), 'MMM d, yyyy HH:mm')
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time Remaining</p>
                  <p className={ticket.sla_breached ? 'text-red-400 font-semibold' : 'text-white'}>
                    {ticket.sla_breached 
                      ? 'BREACHED' 
                      : `${Math.round(ticket.time_remaining_hours)} hours`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={ticket.sla_breached ? 'text-red-400' : 'text-green-400'}>
                    {ticket.sla_breached ? 'Overdue' : 'On Track'}
                  </p>
                </div>
              </div>
            </div>

            {/* Assignment */}
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Assignment</h4>
              <div className="space-y-2">
                {ticket.assigned_department ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{ticket.assigned_department}</span>
                  </div>
                ) : (
                  <p className="text-slate-500">Not assigned to any department</p>
                )}
                
                {ticket.assigned_worker && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{ticket.assigned_worker}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Verification Status */}
            {ticket.verification_status !== 'pending' && (
              <div className={`p-4 rounded-lg ${
                ticket.verification_status === 'passed' 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-red-500/10 border border-red-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {ticket.verification_status === 'passed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      ticket.verification_status === 'passed' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      Verification {ticket.verification_status}
                    </p>
                    {ticket.image_similarity_score !== undefined && (
                      <p className="text-sm text-slate-400">
                        Image similarity: {(ticket.image_similarity_score * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="location">
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-slate-500" />
                  <span className="text-slate-300">
                    {ticket.latitude.toFixed(6)}, {ticket.longitude.toFixed(6)}
                  </span>
                </div>
                
                {/* Static map placeholder - in production, use actual map */}
                <div className="h-64 bg-slate-800 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500">Map view would be displayed here</p>
                    <p className="text-sm text-slate-600">
                      Lat: {ticket.latitude.toFixed(4)}, Lng: {ticket.longitude.toFixed(4)}
                    </p>
                  </div>
                </div>
                
                {ticket.cluster_radius > 0 && (
                  <p className="text-sm text-slate-400 mt-2">
                    Cluster radius: {ticket.cluster_radius} meters
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="images">
            <div className="space-y-4">
              {ticket.before_image_url ? (
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Before (Reported)</h4>
                  <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                    <img 
                      src={ticket.before_image_url} 
                      alt="Before"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `
                          <div class="text-center">
                            <div class="text-slate-600 mb-2">📷</div>
                            <p class="text-slate-500">Image not available</p>
                          </div>
                        `;
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">No before image available</p>
                </div>
              )}

              {ticket.after_image_url ? (
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">After (Resolved)</h4>
                  <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                    <img 
                      src={ticket.after_image_url} 
                      alt="After"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = `
                          <div class="text-center">
                            <div class="text-slate-600 mb-2">📷</div>
                            <p class="text-slate-500">Image not available</p>
                          </div>
                        `;
                      }}
                    />
                  </div>
                  {ticket.image_similarity_score !== undefined && (
                    <p className="text-sm text-slate-400 mt-2">
                      Similarity score: {(ticket.image_similarity_score * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              ) : ticket.status === 'resolved' || ticket.status === 'verified' || ticket.status === 'closed' ? (
                <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500">No after image available</p>
                </div>
              ) : null}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-slate-400 mb-4">Status History</h4>
                
                {/* Timeline */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <History className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-white">Ticket Created</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  
                  {ticket.assigned_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Assigned</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(ticket.assigned_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {ticket.started_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Work Started</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(ticket.started_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {ticket.resolved_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-white">Resolved</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(ticket.resolved_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
          <Button variant="outline" onClick={onClose} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white">
            Close
          </Button>
          {ticket.status !== 'resolved' && ticket.status !== 'verified' && ticket.status !== 'closed' && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 z-[10500]">
                  <SelectItem value="reported" className="focus:bg-slate-700 focus:text-white cursor-pointer">Reported</SelectItem>
                  <SelectItem value="assigned" className="focus:bg-slate-700 focus:text-white cursor-pointer">Assigned</SelectItem>
                  <SelectItem value="in_progress" className="focus:bg-slate-700 focus:text-white cursor-pointer">In Progress</SelectItem>
                  <SelectItem value="on_site" className="focus:bg-slate-700 focus:text-white cursor-pointer">On Site</SelectItem>
                  <SelectItem value="resolved" className="focus:bg-slate-700 focus:text-white cursor-pointer">Resolved</SelectItem>
                  <SelectItem value="escalated" className="focus:bg-slate-700 focus:text-white cursor-pointer">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleUpdateStatus} 
                disabled={isUpdating || newStatus === ticket.status}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
