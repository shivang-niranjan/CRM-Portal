import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  
  // Custom WebRTC Camera States
  const [cameraTask, setCameraTask] = useState<Ticket | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      // In a real app, we'd fetch worker_id from profile
      // For demo, we fetch all active tickets and filter in-progress ones
      const tasks = await api.getTickets();
      const active = tasks.filter(t => ['assigned', 'in_progress', 'on_site'].includes(t.status));
      setActiveTasks(active);
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

  const handleUpdateStatus = async (ticketId: number, status: string) => {
    try {
        await api.updateTicket(ticketId, { status });
        toast.success(`Status updated to ${status.replace('_', ' ')}`);
        fetchTasks();
    } catch (err) {
        toast.error("Failed to update status");
    }
  };

  const openCamera = async (task: Ticket) => {
    setCameraTask(task);
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(videoStream);
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }
    } catch (err) {
      toast.error("Camera access denied or unavailable.");
      setCameraTask(null);
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCameraTask(null);
  };

  const captureAndResolve = async () => {
    if (!videoRef.current || !cameraTask) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the active video frame to canvas
    ctx.drawImage(videoRef.current, 0, 0);
    
    // Shut down HTML5 camera stream immediately to save battery
    closeCamera();
    setIsResolving(cameraTask.id);

    if (!navigator.geolocation) {
        toast.error("Geolocation not supported. Required for resolution.");
        setIsResolving(null);
        return;
    }

    toast.info("Acquiring exact GPS lock to burn watermark...");

    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            // Apply Secure GeoTag Stripe natively onto canvas context
            const barHeight = Math.max(120, canvas.height * 0.1);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
            
            const fontSize = Math.max(20, Math.floor(barHeight * 0.25));
            ctx.fillStyle = '#10B981'; // Emerald 500
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.fillText(`✓ PS-CRM SECURE GEO-TAG`, 20, canvas.height - barHeight + fontSize + 10);
            
            ctx.fillStyle = 'white';
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillText(`Lat: ${pos.coords.latitude.toFixed(6)} | Lng: ${pos.coords.longitude.toFixed(6)}`, 20, canvas.height - Math.floor(barHeight * 0.3));
            ctx.fillText(`Time: ${new Date().toLocaleString()}`, 20, canvas.height - 15);
            
            canvas.toBlob(async (blob) => {
              if (!blob) throw new Error("Canvas rendering failed");
              
              const file = new File([blob], `resolution_${cameraTask.id}.jpg`, { type: 'image/jpeg' });
              
              toast.info("Uploading geo-tagged evidence...");
              const imageUrl = await api.uploadImage(file);

              const result = await api.resolveTicket(cameraTask.id, {
                  after_image_url: imageUrl,
                  resolution_notes: "Issue resolved securely via WebRTC camera.",
                  worker_id: user?.username || "worker_1",
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
              });

              if (result.success) {
                  toast.success(result.message);
                  fetchTasks();
              } else {
                  toast.error(result.message);
              }
              setIsResolving(null);
            }, 'image/jpeg', 0.9);
        } catch (err: any) {
            console.error("Resolution failed:", err);
            toast.error("Upload process failed.");
            setIsResolving(null);
        }
    }, () => {
        toast.error("Failed to acquire GPS lock. Location mapping must be enabled!");
        setIsResolving(null);
    }, { enableHighAccuracy: true });
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
              <CardFooter className="p-2 bg-slate-800/30 flex gap-2 shrink-0 flex-wrap items-center">
                <Button 
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs h-8 min-w-[100px]"
                  onClick={() => handleNavigate(task.latitude, task.longitude)}
                >
                  <Navigation className="w-3 h-3 mr-1" /> Navigate
                </Button>
                
                <div className="flex-1 min-w-[120px]">
                  <Select value={task.status} onValueChange={(val) => handleUpdateStatus(task.id, val)}>
                    <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="on_site">On Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[100px]">
                  <Button 
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-500 text-xs h-8 font-bold tracking-wide"
                    disabled={isResolving === task.id || task.status !== 'on_site'}
                    onClick={() => openCamera(task)}
                  >
                    {isResolving === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Camera className="w-4 h-4 mr-1.5" />}
                    Resolve
                  </Button>
                </div>
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
        
      {/* Live Camera Modal Viewfinder */}
      <Dialog open={cameraTask !== null} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 p-0 overflow-hidden text-white flex flex-col items-center">
          <div className="w-full bg-black relative min-h-[300px] flex items-center justify-center">
            {stream ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-auto max-h-[70vh] object-cover"
                onLoadedMetadata={() => videoRef.current?.play()}
              />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            )}
            
            {/* Viewfinder crosshairs representing image center context */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div className="w-48 h-48 border border-emerald-500/50 rounded-xl flex items-center justify-center relative before:content-[''] before:absolute before:w-full before:h-[1px] before:bg-emerald-500/30 after:content-[''] after:absolute after:h-full after:w-[1px] after:bg-emerald-500/30">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse blur-[1px] shadow-[0_0_10px_red]" />
              </div>
            </div>
            
            {/* GeoTag overlay preview warning */}
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent pt-12 pb-4 px-4 text-[11px] sm:text-xs text-white font-mono flex flex-col gap-1 z-10">
              <span className="text-emerald-400 font-bold tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 animate-bounce" /> SECURE LIVE CAPTURE ACTIVE
              </span>
              <span className="text-slate-300">Your GPS coordinates and timestamp will be permanently burned into this image upon capture.</span>
            </div>
          </div>
          <div className="p-4 w-full flex gap-3 bg-slate-900 border-t border-slate-800 shrink-0 z-20">
             <Button variant="outline" className="flex-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white" onClick={closeCamera}>
                Cancel
             </Button>
             <Button className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={captureAndResolve} disabled={!stream}>
                <Camera className="w-5 h-5 mr-2" /> Snap & Upload Evidence
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkerView;
