/**
 * Live Map Component
 * Real-time GIS visualization of tickets using Leaflet
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Droplets, 
  Trash2, 
  Filter,
  Layers,
  LocateFixed,
  RefreshCw
} from 'lucide-react';
import type { MapMarker, Ticket } from '@/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
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

// Set default icon for all markers
L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons by category
const createCategoryIcon = (category: string, priority: string) => {
  const colors: Record<string, string> = {
    electricity: '#eab308',
    water: '#3b82f6',
    roads: '#6b7280',
    sanitation: '#22c55e',
  };
  
  const priorityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  
  const color = colors[category.toLowerCase()] || '#64748b';
  const borderColor = priorityColors[priority.toLowerCase()] || color;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 3px solid ${borderColor};
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="color: white; font-size: 10px; font-weight: bold;">
          ${category.charAt(0)}
        </span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

interface LiveMapProps {
  onTicketClick?: (ticket: Ticket) => void;
}

// Map controller component for programmatic control
function MapController({ 
  center, 
  zoom 
}: { 
  center: [number, number]; 
  zoom: number;
}) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  
  return null;
}

export default function LiveMap({ onTicketClick }: LiveMapProps) {
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [filteredMarkers, setFilteredMarkers] = useState<MapMarker[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.7041, 77.1025]); // Delhi
  const [mapZoom, setMapZoom] = useState(12);
  const mapRef = useRef<L.Map | null>(null);

  const fetchMarkers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getMapMarkers();
      setMarkers(data);
    } catch (error) {
      console.error('Failed to fetch map markers:', error);
      toast.error('Failed to fetch map markers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkers();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchMarkers, 10000);
    return () => clearInterval(interval);
  }, [fetchMarkers]);

  useEffect(() => {
    const filterMarkers = () => {
      let filtered = markers;
      
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(m => 
          m.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }
      
      if (selectedStatus !== 'all') {
        filtered = filtered.filter(m => 
          m.status.toLowerCase() === selectedStatus.toLowerCase()
        );
      }
      
      setFilteredMarkers(filtered);
    };

    filterMarkers();
  }, [markers, selectedCategory, selectedStatus]);

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter([latitude, longitude]);
          setMapZoom(15);
          toast.success('Located your position');
        },
        () => {
          toast.error('Could not get your location');
        }
      );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'electricity':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'water':
        return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'roads':
        return <div className="w-4 h-4 bg-gray-500 rounded-sm" />;
      case 'sanitation':
        return <Trash2 className="w-4 h-4 text-green-500" />;
      default:
        return <Layers className="w-4 h-4" />;
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm text-slate-200"
              >
                <option value="all">All Categories</option>
                <option value="electricity">Electricity</option>
                <option value="water">Water</option>
                <option value="roads">Roads</option>
                <option value="sanitation">Sanitation</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1 text-sm text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="reported">Reported</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="on_site">On Site</option>
              </select>
            </div>

            <div className="flex-1"></div>

            {/* Action Buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLocate}
              className="border-slate-700"
            >
              <LocateFixed className="w-4 h-4 mr-2" />
              Locate Me
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMarkers}
              disabled={isLoading}
              className="border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-800">
            <span className="text-sm text-slate-400">
              Showing <strong className="text-white">{filteredMarkers.length}</strong> of{' '}
              <strong className="text-white">{markers.length}</strong> tickets
            </span>
            
            <div className="flex items-center gap-4">
              {['electricity', 'water', 'roads', 'sanitation'].map(cat => {
                const count = markers.filter(m => 
                  m.category.toLowerCase() === cat
                ).length;
                return (
                  <div key={cat} className="flex items-center gap-1 text-xs">
                    {getCategoryIcon(cat)}
                    <span className="text-slate-400 capitalize">{cat}:</span>
                    <span className="text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <div className="h-[600px] relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <MapController center={mapCenter} zoom={mapZoom} />
            
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {filteredMarkers.map((marker) => (
              <div key={marker.id}>
                {/* Cluster radius circle */}
                <Circle
                  center={[marker.latitude, marker.longitude]}
                  radius={marker.cluster_radius}
                  pathOptions={{
                    fillColor: marker.report_count > 1 ? '#3b82f6' : '#64748b',
                    fillOpacity: 0.1,
                    color: marker.report_count > 1 ? '#3b82f6' : '#64748b',
                    weight: 1,
                  }}
                />
                
                {/* Marker */}
                <Marker
                  position={[marker.latitude, marker.longitude]}
                  icon={createCategoryIcon(marker.category, marker.priority)}
                  eventHandlers={{
                    click: () => {
                      // Fetch full ticket details and open modal
                      api.getTicket(marker.id).then(ticket => {
                        onTicketClick?.(ticket);
                      });
                    },
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">
                          {marker.ticket_number}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getPriorityColor(marker.priority)}`}
                        >
                          {marker.priority}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryIcon(marker.category)}
                        <span className="text-sm capitalize">{marker.category}</span>
                      </div>
                      
                      <div className="text-xs text-slate-500 mb-2">
                        Status: <span className="capitalize">{marker.status.replace('_', ' ')}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          Urgency: {marker.urgency_score}/10
                        </span>
                        {marker.report_count > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {marker.report_count} reports
                          </Badge>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        className="w-full mt-3 bg-blue-600 hover:bg-blue-500 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          api.getTicket(marker.id).then(ticket => {
                            onTicketClick?.(ticket);
                          });
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              </div>
            ))}
          </MapContainer>
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
              <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading tickets...</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Legend */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-400">Map Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-yellow-600"></div>
              <span className="text-sm text-slate-300">Electricity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600"></div>
              <span className="text-sm text-slate-300">Water</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-gray-600"></div>
              <span className="text-sm text-slate-300">Roads</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-green-600"></div>
              <span className="text-sm text-slate-300">Sanitation</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Priority Indicators (Border Color):</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-red-500"></div>
                <span className="text-xs text-slate-400">Critical</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-orange-500"></div>
                <span className="text-xs text-slate-400">High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-yellow-500"></div>
                <span className="text-xs text-slate-400">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-green-500"></div>
                <span className="text-xs text-slate-400">Low</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
