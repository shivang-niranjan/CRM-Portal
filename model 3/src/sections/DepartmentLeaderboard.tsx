/**
 * Department Leaderboard Component
 * Gamified accountability with department rankings
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Medal, 
  Award, 
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Zap,
  Droplets,
  Trash2,
  Clock,
  CheckCircle2
} from 'lucide-react';
import type { LeaderboardEntry } from '@/types';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function DepartmentLeaderboard() {
  const [departments, setDepartments] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [totalToday, setTotalToday] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getDepartmentLeaderboard();
      setDepartments(data.departments);
      setLastUpdated(data.last_updated);
      setTotalToday(data.total_tickets_today);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      toast.error('Failed to fetch leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    
    // Poll for updates every 5 minutes
    const interval = setInterval(fetchLeaderboard, 300000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-slate-500 font-semibold">{rank}</span>;
    }
  };

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
        return <Star className="w-5 h-5" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getEfficiencyBadge = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/50';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (score >= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    return 'bg-red-500/20 text-red-400 border-red-500/50';
  };

  const getTrustBadges = (count: number) => {
    const badges = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      badges.push(
        <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
      );
    }
    return badges;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Department Leaderboard</h2>
                <p className="text-slate-400">
                  Real-time rankings by efficiency • {totalToday} tickets resolved today
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-sm text-slate-500">
                  Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </span>
              )}
              
              <Button
                variant="outline"
                onClick={fetchLeaderboard}
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

      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {departments.slice(0, 3).map((dept, index) => (
          <Card 
            key={dept.id}
            className={`bg-slate-900 border-slate-800 ${
              index === 0 ? 'border-yellow-500/50 ring-2 ring-yellow-500/20' : ''
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getRankIcon(dept.rank)}
                  <div>
                    <h3 className="font-semibold text-white">{dept.name}</h3>
                    <p className="text-xs text-slate-400">{dept.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {getTrendIcon(dept.trend)}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                {getCategoryIcon(dept.category)}
                <span className="text-sm text-slate-400 capitalize">{dept.category}</span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-400">Efficiency Score</span>
                    <span className={`text-lg font-bold ${getEfficiencyColor(dept.efficiency_score)}`}>
                      {dept.efficiency_score}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${dept.efficiency_score}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Tickets Resolved</p>
                    <p className="text-white font-semibold">{dept.total_tickets_resolved}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Avg Resolution</p>
                    <p className="text-white font-semibold">
                      {dept.avg_resolution_time_hours ? `${Math.round(dept.avg_resolution_time_hours)}h` : 'N/A'}
                    </p>
                  </div>
                </div>
                
                {dept.trust_badge_count > 0 && (
                  <div className="flex items-center gap-1 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-500 mr-1">Trust Badges:</span>
                    {getTrustBadges(dept.trust_badge_count)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Full Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Category</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Efficiency</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Resolved</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Avg Time</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Satisfaction</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Trend</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr 
                    key={dept.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800">
                        <span className={`font-semibold ${
                          dept.rank <= 3 ? 'text-yellow-500' : 'text-slate-400'
                        }`}>
                          {dept.rank}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-white">{dept.name}</p>
                        <p className="text-xs text-slate-500">{dept.code}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(dept.category)}
                        <span className="text-sm text-slate-300 capitalize">{dept.category}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Badge 
                        variant="outline" 
                        className={getEfficiencyBadge(dept.efficiency_score)}
                      >
                        {dept.efficiency_score}%
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-white font-medium">
                        {dept.total_tickets_resolved.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-300">
                          {dept.avg_resolution_time_hours 
                            ? `${Math.round(dept.avg_resolution_time_hours)}h` 
                            : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-slate-300">
                          {dept.satisfaction_score.toFixed(1)}/10
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {getTrendIcon(dept.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Explanation */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-400">How Efficiency Score is Calculated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <p className="font-medium text-white mb-1">Resolution Speed (40%)</p>
              <p className="text-slate-400">Faster resolution = higher score. Target: under 48 hours.</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <p className="font-medium text-white mb-1">Citizen Satisfaction (40%)</p>
              <p className="text-slate-400">Based on feedback ratings and verification success.</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <p className="font-medium text-white mb-1">Volume Handled (20%)</p>
              <p className="text-slate-400">Total tickets resolved relative to department capacity.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
