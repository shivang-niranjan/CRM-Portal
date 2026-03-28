import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  MapPin, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Mic,
  Camera,
  Loader2,
  Medal,
  Award
} from 'lucide-react';
import { api } from '@/lib/api';
import type { CitizenReport, CitizenLeaderboardEntry } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const StatusStepper = ({ status }: { status: string }) => {
  const steps = ['reported', 'assigned', 'in_progress', 'resolved'];
  
  // Normalize backend statuses to fit the 4 visual steps
  let normalizedStatus = status.toLowerCase();
  if (normalizedStatus === 'clustered') normalizedStatus = 'reported';
  if (normalizedStatus === 'on_site') normalizedStatus = 'in_progress';
  if (normalizedStatus === 'closed' || normalizedStatus === 'verified') normalizedStatus = 'resolved';

  const currentIndex = steps.indexOf(normalizedStatus);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex; // Default to 'reported' if unknown
  
  return (
    <div className="flex items-center w-full mt-4 gap-1">
      {steps.map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center flex-1">
            <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${
              idx <= activeIndex ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'
            }`} />
            <span className={`text-[10px] mt-1 capitalize font-medium ${
              idx <= activeIndex ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {step.replace('_', ' ')}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-[2px] flex-1 mb-4 transition-colors duration-500 ${
              idx < activeIndex ? 'bg-emerald-500' : 'bg-slate-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const [complaintText, setComplaintText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myReports, setMyReports] = useState<CitizenReport[]>([]);
  const [leaderboard, setLeaderboard] = useState<CitizenLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.username) return;
    try {
      setIsLoading(true);
      const [reportsData, leaderboardData] = await Promise.all([
        api.getMyReports(user.username),
        api.getCitizenLeaderboard()
      ]);
      setMyReports(reportsData);
      setLeaderboard(leaderboardData.citizens);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto-refresh for live status
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleVoiceIntake = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech Recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.info("Listening... Speak now");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setComplaintText(prev => prev + (prev ? ' ' : '') + transcript);
      toast.success("Voice transcribed successfully!");
    };

    recognition.onerror = (event: any) => {
      console.error("Speech endpoint error:", event.error);
      toast.error(`Recording failed: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location tagged automatically");
      });
    }
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      toast.success("Photo attached successfully");
    }
  };

  const handleSubmit = async () => {
    if (!complaintText) return toast.error("Please describe the issue");
    if (!location) return toast.error("Please add location");

    setIsSubmitting(true);
    try {
      let uploadedUrl = "https://images.unsplash.com/photo-1584467541268-b040f83be3fd?w=400";
      if (imageFile) {
        uploadedUrl = await api.uploadImage(imageFile);
      }

      await api.createReport({
        description: complaintText,
        latitude: location.lat,
        longitude: location.lng,
        citizen_id: user?.username,
        citizen_name: user?.username,
        source: 'web',
        image_url: uploadedUrl
      });
      setComplaintText('');
      setLocation(null);
      setImageFile(null);
      setImagePreview(null);
      fetchData();
      toast.success("Complaint submitted successfully! AI is categorizing it now.");
    } catch (error) {
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find current user's stats
  const currentUserStats = leaderboard.find(l => l.citizen_name === user?.username);
  const userScore = currentUserStats?.total_score || (myReports.length * 10);
  const userBadge = currentUserStats?.badge || (userScore >= 300 ? "Diamond" : userScore >= 150 ? "Gold" : userScore >= 50 ? "Silver" : "Bronze");
  
  const getBadgeColor = (badge: string) => {
    switch(badge) {
      case 'Diamond': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'Gold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Silver': return 'bg-slate-300/20 text-slate-300 border-slate-300/30';
      default: return 'bg-orange-700/20 text-orange-600 border-orange-700/30';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Main Dashboard */}
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <CardHeader>
              <CardTitle className="text-xl">Welcome back, {user?.username}!</CardTitle>
              <p className="text-slate-300 text-sm">Your contributions keep Delhi running smoothly.</p>
            </CardHeader>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                Citizen Trust Score
              </CardTitle>
              <p className="text-3xl font-bold text-white mt-1">{userScore} <span className="text-sm text-slate-500 font-normal">pts</span></p>
              <Badge className={`w-fit mt-2 ${getBadgeColor(userBadge)}`}>{userBadge} Member</Badge>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-400" />
              New Complaint Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <textarea 
                  placeholder="Describe the issue in detail, or use voice dictation →" 
                  className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 pr-24 min-h-[140px] text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all drop-shadow-sm"
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                />
                <div className="absolute right-3 top-3 flex flex-col gap-2 items-end">
                  <div className="flex bg-slate-900/90 rounded-md p-1 border border-slate-700 shadow-sm backdrop-blur-sm">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className={`h-8 w-8 rounded-md transition-colors ${isRecording ? 'text-red-500 animate-pulse bg-red-500/10 hover:bg-red-500/20 hover:text-red-400' : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'}`}
                      onClick={handleVoiceIntake}
                    >
                      <Mic className="w-4 h-4" />
                    </Button>
                    <select 
                      className="bg-transparent text-[11px] font-bold tracking-wide text-slate-400 border-none outline-none cursor-pointer px-1 h-8"
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                    >
                      <option value="en-IN">EN</option>
                      <option value="hi-IN">HI</option>
                      <option value="mr-IN">MR</option>
                      <option value="ta-IN">TA</option>
                    </select>
                  </div>
                  {isRecording && <span className="text-[10px] font-medium text-red-500 animate-pulse pr-1 bg-slate-900/80 px-2 py-0.5 rounded shadow-sm">Listening...</span>}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  className={`border-slate-800 flex-1 ${location ? 'text-green-400 border-green-500/30' : ''}`}
                  onClick={handleGetLocation}
                >
                  <MapPin className="w-4 h-4 mr-2" /> {location ? 'Location Set' : 'Tag Location'}
                </Button>
                <div className="flex-1 relative overflow-hidden rounded-md min-w-[120px]">
                  <input 
                    type="file" 
                    id="citizen-camera"
                    accept="image/*" 
                    capture="environment" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleImageCapture}
                  />
                  <Button variant="outline" className={`w-full border-slate-800 ${imageFile ? 'text-blue-400 border-blue-500/30' : ''}`} asChild>
                    <div><Camera className="w-4 h-4 mr-2" /> {imageFile ? 'Photo Added' : 'Add Photo'}</div>
                  </Button>
                </div>
                <Button 
                  className="bg-blue-600 hover:bg-blue-500 flex-[2]"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                  Submit Ticket
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            My Active Tickets
          </h3>
          
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-500" /></div>
          ) : myReports.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-lg border border-slate-800 border-dashed">
              <p className="text-slate-500">No active tickets. Your neighborhood is clean!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myReports.map(report => (
                <Card key={report.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 rounded-lg bg-blue-500/10">
                          <AlertCircle className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white line-clamp-1">{report.description}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4 bg-slate-800">{report.source}</Badge>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(report.created_at))} ago
                            </p>
                          </div>
                        </div>
                      </div>
                      {report.category && (
                        <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                          {report.category}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Status Tracking</span>
                        <span className="text-[10px] text-blue-400 font-bold uppercase">Syncing...</span>
                      </div>
                      <StatusStepper status={report.master_ticket_status || (report.master_ticket_id ? 'clustered' : 'reported')} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Leaderboard */}
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-800 h-full">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
              <Award className="w-5 h-5" />
              Neighborhood Leaders
            </CardTitle>
            <p className="text-xs text-slate-500">Top contributors making Delhi better this month.</p>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-500" /></div>
            ) : leaderboard.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No data available yet</div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {leaderboard.map((citizen, idx) => (
                  <div key={idx} className={`p-4 flex items-center justify-between transition-colors ${citizen.citizen_name === user?.username ? 'bg-blue-600/10' : 'hover:bg-slate-800/30'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                          idx === 1 ? 'bg-slate-300/20 text-slate-300' :
                          idx === 2 ? 'bg-orange-700/20 text-orange-600' : 
                          'bg-slate-800 text-slate-400'}`}
                      >
                        #{citizen.rank}
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {citizen.citizen_name}
                          {citizen.citizen_name === user?.username && <Badge variant="outline" className="text-[8px] h-3 px-1 py-0 bg-blue-500/20 text-blue-400 border-none">YOU</Badge>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Medal className="w-3 h-3" /> {citizen.reports_submitted} Issues Resolved
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-bold text-blue-400">{citizen.total_score} pt</span>
                      <Badge className={`mt-1 text-[8px] px-1.5 py-0 ${getBadgeColor(citizen.badge)}`}>
                        {citizen.badge}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
};

export default CitizenDashboard;
