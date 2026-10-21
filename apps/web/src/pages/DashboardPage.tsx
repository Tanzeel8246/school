import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  Users, BookOpen, GraduationCap, DollarSign, 
  TrendingUp, Activity, Calendar, Bell, ArrowUpRight, CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DashboardData {
  role: string;
  widgets: any;
}

const CURRENCY = 'Rs. ';

function formatMoney(value: number): string {
  return `${CURRENCY}${(value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const dashRes = await api.get<DashboardData>('/dashboard');
        if (!cancelled) {
          setData(dashRes.data);
        }
      } catch {
        if (!cancelled) setError('Could not load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse p-4">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800/50 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl"></div>
          <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 text-red-700 backdrop-blur-sm m-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> Error Loading Dashboard
        </h3>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  const w = data?.widgets || data || {};
  const role = data?.role || user?.role;

  // Principal / Admin Dashboard
  if (role === 'principal' || role === 'super_admin') {
    return (
      <div className="space-y-8 pb-12 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 relative z-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground dark:text-white mb-2">
              Dashboard Overview
            </h1>
            <p className="text-lg text-muted-foreground dark:text-muted-foreground">
              Welcome back, <span className="font-semibold text-primary">{user?.name}</span>. Here's what's happening today.
            </p>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-sm font-medium px-5 py-2.5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 dark:border-slate-800 rounded-xl shadow-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-foreground dark:text-slate-200">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
             </div>
          </div>
        </div>

        {/* Top KPI Cards - Glassmorphism Premium Design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +12%
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">Total Students</p>
                <h3 className="text-4xl font-bold text-foreground dark:text-white tracking-tight">
                  {w.totalStudents?.toLocaleString() || 0}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> On Track
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">Fee Collected</p>
                <h3 className="text-4xl font-bold text-foreground dark:text-white tracking-tight">
                  {formatMoney(w.feeCollectedThisMonth || 0)}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Activity className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">Today's Attendance</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-4xl font-bold text-foreground dark:text-white tracking-tight">
                    {w.attendancePercentToday || 0}%
                  </h3>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${w.attendancePercentToday || 0}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl group hover:-translate-y-1 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-1">Staff & Teachers</p>
                <h3 className="text-4xl font-bold text-foreground dark:text-white tracking-tight mb-1">
                  {w.totalStaff || 0}
                </h3>
                <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Including {w.totalTeachers || 0} teachers
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                    Revenue Summary
                  </CardTitle>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">Collection vs Target over 6 months</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-muted-foreground dark:text-slate-300" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={w.revenueSummary || []} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8}/>
                      </linearGradient>
                      <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#f1f5f9" stopOpacity={0.2}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `${val/1000}k`} dx={-10} />
                    <Tooltip cursor={{fill: 'rgba(241, 245, 249, 0.4)'}} contentStyle={{borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.9)'}} />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '13px', fontWeight: 500}} />
                    <Bar dataKey="collected" name="Collected" fill="url(#colorCollected)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="target" name="Target" fill="url(#colorTarget)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                    Attendance Trends
                  </CardTitle>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">Daily attendance percentage (14 days)</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-muted-foreground dark:text-slate-300" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={w.attendanceTrend || []} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[0, 100]} dx={-10} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.9)'}} />
                    <Area type="monotone" dataKey="value" name="Attendance %" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorTrend)" activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                Academic Performance (GPA)
              </CardTitle>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">Average GPA across different grades</p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={w.academicPerformance || []} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis dataKey="grade" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} domain={[0, 4.0]} dx={-10} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.9)'}} />
                    <Line type="monotone" dataKey="gpa" name="Average GPA" stroke="#10b981" strokeWidth={4} dot={{r: 5, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 7, strokeWidth: 0, fill: '#10b981'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col overflow-hidden relative">
            <div className="absolute -right-20 -top-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <CardHeader className="pb-4 relative z-10">
              <CardTitle className="text-xl font-bold flex items-center justify-between">
                <span>Recent Activity</span>
                <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 relative z-10 flex flex-col">
              <div className="space-y-6 flex-1">
                {(w.recentAnnouncements || []).map((ann: any, idx: number) => (
                  <div key={idx} className="flex gap-4 relative group cursor-pointer">
                    {idx !== (w.recentAnnouncements?.length || 0) - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-200 dark:bg-slate-800 transition-colors group-hover:bg-primary/30"></div>
                    )}
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex-shrink-0 z-10 flex items-center justify-center shadow-sm group-hover:bg-primary/20 transition-colors">
                       <div className="w-2.5 h-2.5 rounded-full bg-slate-400 group-hover:bg-primary transition-colors"></div>
                    </div>
                    <div className="pt-1.5 pb-2">
                      <p className="text-sm font-semibold text-foreground dark:text-white leading-tight group-hover:text-primary transition-colors">
                        {ann.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {ann.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-semibold">
                        {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {!(w.recentAnnouncements?.length) && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Bell className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No recent activities</p>
                  </div>
                )}
              </div>
              <button className="w-full mt-6 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm">
                View All Activities <ArrowUpRight className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fallback for other roles
  const entries = Object.entries(w).filter(([k]) => {
    const hiddenKeys = ['recentAnnouncements', 'revenueSummary', 'attendanceTrend', 'academicPerformance'];
    return !hiddenKeys.includes(k) && !hiddenKeys.includes(k.toLowerCase());
  });
  
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground dark:text-white mb-2">
            Welcome, <span className="text-primary">{user?.name}</span>
          </h1>
          <p className="text-lg text-muted-foreground dark:text-muted-foreground">
             {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard` : 'Dashboard'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.map(([key, value]) => {
          let v = value;
          let label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          if (typeof value === 'number' && (/fee|pending|collected/i.test(key))) {
            v = formatMoney(value);
          }
          return (
            <Card key={key} className="border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl hover:-translate-y-1 transition-all duration-300">
              <CardContent className="p-8">
                <p className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground mb-3 uppercase tracking-wider">{label}</p>
                <h3 className="text-4xl font-bold text-foreground dark:text-white">{v as string}</h3>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
