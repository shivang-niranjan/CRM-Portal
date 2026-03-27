import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  MapPin, 
  Navigation, 
  AlertTriangle,
  Clock,
  Briefcase,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Ticket } from '@/types';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const WorkerView: React.FC = () => {
  const { user } = useAuth();
  const [activeTasks, setActiveTasks] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      // In a real app, we'd fetch worker_id from profile
      // For demo, we'll fetch all assigned tickets if no worker_id is linked
      const tasks = await api.getTickets({ status: 'assigned' });
      setActiveTasks(tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleNavigate = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleResolve = async (ticket: Ticket) => {
    setIsResolving(ticket.id);
    toast.info("Capturing secure location and image...");
    
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by browser");
      setIsResolving(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const result = await api.resolveTicket(ticket.id, {
          after_image_url: "https://images.unsplash.com/photo-1590479773265-7464e5d48118?w=400", // Simulated capture
          resolution_notes: "Issue resolved successfully. Verified on-site.",
          worker_id: user?.username || "worker_1",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });

        if (result.success) {
          toast.success(`Resolved! AI Verification: ${result.verification_status} (${Math.round(result.image_similarity_score * 100)}% match)`);
          fetchTasks();
        }
      } catch (error: any) {
        // Error is handled by api interceptor toast
        console.error("Resolution failed:", error);
      } finally {
        setIsResolving(null);
      }
    }, () => {
      toast.error("Failed to get location. Resolution aborted.");
      setIsResolving(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <Briefcase className="w-6 h-6 text-orange-400" />
          Field Assignments
        </h2>
        <Badge variant="outline" className="text-orange-400 border-orange-400/30">
          {activeTasks.length} Pending
        </Badge>
      </div>

      {/* Unified Worker Map */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="h-64 w-full z-0 relative">
          {!isLoading && activeTasks.length > 0 ? (
            <MapContainer 
              center={[activeTasks[0].latitude, activeTasks[0].longitude]} 
              zoom={13} 
              style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {activeTasks.map(task => (
                <Marker key={task.id} position={[task.latitude, task.longitude]}>
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[150px]">
                      <Badge className="mb-2 bg-blue-600">{task.ticket_number}</Badge>
                      <p className="text-sm font-medium">{task.description}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-slate-900/50">
              <MapPin className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
            </div>
          )}
        </div>
      </Card>

      {/* Compact Tasks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="flex justify-center py-12 md:col-span-2"><Loader2 className="animate-spin text-orange-500" /></div>
        ) : activeTasks.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 border-dashed md:col-span-2">
            <CardContent className="p-12 text-center text-slate-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>All clear! No pending assignments.</p>
            </CardContent>
          </Card>
        ) : (
          activeTasks.map(task => (
            <Card key={task.id} className="bg-slate-900 border-slate-800 overflow-hidden hover:border-slate-700 transition-colors flex flex-col">
              <CardHeader className="p-3 border-b border-slate-800/50 bg-slate-800/20">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex gap-2 flex-col items-start">
                    <Badge className={task.priority === 'critical' ? 'bg-red-600' : task.priority === 'high' ? 'bg-orange-600' : 'bg-blue-600'}>
                      {task.priority} Priority
                    </Badge>
                    <CardTitle className="text-sm mt-1 text-white line-clamp-2">{task.description}</CardTitle>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 font-mono">{task.ticket_number}</p>
                    {task.sla_breached ? (
                      <p className="text-xs text-red-400 font-bold flex items-center justify-end gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> BREACHED
                      </p>
                    ) : (
                      <p className="text-xs text-orange-400 font-medium flex items-center justify-end gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {Math.round(task.time_remaining_hours)}h
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 flex-1 flex flex-col justify-end">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}
                </div>
              </CardContent>
              <CardFooter className="p-2 bg-slate-800/30 flex gap-2 shrink-0">
                <Button 
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs h-8"
                  onClick={() => handleNavigate(task.latitude, task.longitude)}
                >
                  <Navigation className="w-3 h-3 mr-1" /> Navigate
                </Button>
                <Button 
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-500 text-xs h-8"
                  disabled={isResolving === task.id}
                  onClick={() => handleResolve(task)}
                >
                  {isResolving === task.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Camera className="w-3 h-3 mr-1" />}
                  Resolve
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Resolution Instructions */}
      <Card className="bg-slate-900/50 border-slate-800 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <p className="text-slate-100 font-medium">Compliance Note & Anti-Corruption Protocol:</p>
              <p>• Only **Live Camera** photos allowed. Background geotagging is active.</p>
              <p>• **Geo-Fencing**: You must be within **100 meters** of the ticket location.</p>
              <p>• **AI Verification**: Image similarity must exceed **threshold** for verification.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkerView;
