import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Building,
  FileText, 
  TrendingUp,
  Shield,
  Search,
  Eye,
  Trash2,
  UserX,
  CheckCircle,
  XCircle,
  Activity,
  Calendar,
  BarChart3,
  ShieldCheck, // <-- New icon for verification
  FileDown     // <-- New icon for document
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface AdminDashboardProps {
  user: {
    fullName: string;
    email: string;
  };
  onLogout: () => void;
}

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Live state connected to backend
  const [stats, setStats] = useState<any>({ totalUsers: 0, activeStudents: 0, activeCompanies: 0, totalInternships: 0, pendingApprovals: 0, thisMonthApplications: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [internships, setInternships] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // track internship dialog state
  const [isInternshipOpen, setIsInternshipOpen] = useState(false);
  const [selectedInternship, setSelectedInternship] = useState<any | null>(null);

  // New state for company verifications
  const [verifications, setVerifications] = useState<any[]>([]);

  // New state for document preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCompanyName, setPreviewCompanyName] = useState<string | null>(null);


  // Load data from backend
  const fetchAnalytics = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/analytics');
      if (res.ok) {
        const d = await res.json();
        setStats(d || {});
      }
    } catch (e) { console.error('Failed to fetch analytics', e); }
  };

  const fetchUsers = async (q = '') => {
    try {
      const url = `http://localhost:5000/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setUsers((d.users || []).map((u:any)=>({ ...u })));
      }
    } catch (e) { console.error('Failed to fetch users', e); }
  };

  const fetchInternships = async (q = '') => {
    try {
      const url = `http://localhost:5000/api/internships${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        setInternships(d.internships || []);
      }
    } catch (e) { console.error('Failed to fetch internships', e); }
  };

  // New fetch function for verification requests
  const fetchVerifications = async () => {
    try {
        const res = await fetch('http://localhost:5000/api/admin/verifications');
        if (res.ok) {
            const d = await res.json();
            const items = (d.verifications || []).map((v:any) => ({
                ...v,
                // backend may return verificationDocumentUrl or documentUrl
                documentUrl: v.verificationDocumentUrl || v.documentUrl || v.verificationDocumentUrl || '',
                // normalize requestedAt from various possible fields
                requestedAt: v.requestedAt || v.verificationRequestedAt || v.requested_at || v.createdAt || v.created_at || v.created || v.requestedOn || v.requested_on || v.timestamp || v.date || null
            }));
            setVerifications(items);
            return;
        }
    } catch (e) {
        console.error('Failed to fetch verifications, using mock data.', e);
        // Fallback to mock data if API fails
        setVerifications([
            { id: 'comp_abc', companyName: 'Innovate Solutions', representative: 'Alice Johnson', email: 'alice@innovate.com', requestedAt: '2025-09-22', documentUrl: '/docs/placeholder.pdf' },
            { id: 'comp_xyz', companyName: 'Data Dynamics', representative: 'Bob Williams', email: 'bob@datadynamics.com', requestedAt: '2025-09-21', documentUrl: '/docs/placeholder.pdf' },
        ]);
    }
  };


  useEffect(() => {
    fetchAnalytics();
    fetchUsers();
    fetchInternships();
    fetchVerifications(); // <-- Fetch verifications on load
    // lightweight recent activity from server not yet implemented, keep a client-side sample
    setRecentActivity([
      { id: 1, action: 'New company registration', details: 'InnovateLabs registered as a new company', timestamp: '2 hours ago', type: 'registration' },
      { id: 2, action: 'Internship approved', details: 'Frontend Developer role at TechCorp approved', timestamp: '4 hours ago', type: 'approval' }
    ]);
  }, []);

  // search hook - refetch when search changes
  useEffect(() => {
    const t = setTimeout(() => {
      fetchUsers(searchTerm);
      fetchInternships(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-success text-success-foreground";
      case "Pending Approval": return "bg-warning text-warning-foreground";
      case "Suspended": case "Rejected": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Format various incoming date shapes into a readable string
  const formatDate = (v: any) => {
    if (!v) return '';
    try {
      // if already a Date
      if (v instanceof Date) return v.toLocaleString();
      // numeric timestamp
      if (typeof v === 'number') return new Date(v).toLocaleString();
      // string: try ISO or millis
      const trimmed = String(v).trim();
      // if looks like a milliseconds epoch
      if (/^\d{13}$/.test(trimmed)) return new Date(parseInt(trimmed, 10)).toLocaleString();
      if (/^\d{10}$/.test(trimmed)) return new Date(parseInt(trimmed, 10) * 1000).toLocaleString();
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return trimmed; // fallback to raw
    } catch (e) { return String(v); }
  };

  const viewProfile = (u:any) => {
    setSelectedUser(u);
    setIsProfileOpen(true);
  };

  const closeProfile = () => { setSelectedUser(null); setIsProfileOpen(false); };

  // view internship details in a dialog — fetch authoritative record before showing
  const viewInternship = async (i:any) => {
    if (!i || !i.id) {
      setSelectedInternship(i);
      setIsInternshipOpen(true);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/internships/${i.id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedInternship(d.internship || i);
      } else {
        setSelectedInternship(i);
      }
    } catch (e) {
      console.error('Failed to fetch internship details', e);
      setSelectedInternship(i);
    }
    setIsInternshipOpen(true);
  };
  const closeInternship = () => { setSelectedInternship(null); setIsInternshipOpen(false); };

  const performUserAction = async (u:any, action:string) => {
    if (!u || !u.id) return;
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${u.id}/${action}`, { method: 'POST' });
      const body = await res.text();
      let parsed: any = null;
      try { parsed = body ? JSON.parse(body) : null; } catch { parsed = { raw: body }; }
      if (res.ok) {
        toast({ title: 'Success', description: parsed?.msg || `${action} completed.`, variant: 'default' });
        fetchUsers();
      } else {
        console.error('User action failed', res.status, parsed);
        toast({ title: 'Error', description: parsed?.msg || parsed?.error || `Failed to ${action} user`, variant: 'destructive' });
      }
    } catch (e) { console.error(e); toast({ title: 'Error', description: `Failed to ${action} user`, variant: 'destructive' }); }
  };

  const deleteUser = async (u:any) => {
    if (!u || !u.id) return;
    if (!confirm('Delete this user permanently?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/users/${u.id}`, { method: 'DELETE' });
      const text = await res.text();
      let parsed:any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
      if (res.ok) {
        toast({ title: 'Deleted', description: parsed?.msg || 'User deleted', variant: 'destructive' });
        fetchUsers();
      } else {
        console.error('Delete failed', res.status, parsed);
        toast({ title: 'Error', description: parsed?.msg || parsed?.error || 'Failed to delete user', variant: 'destructive' });
      }
    } catch (e) { console.error(e); toast({ title: 'Error', description: 'Failed to delete user', variant: 'destructive' }); }
  };
  
  // New handler for approving/rejecting company verifications
  const handleVerificationAction = async (companyId: string, action: 'approve' | 'reject') => {
      if (!confirm(`Are you sure you want to ${action} this verification request?`)) return;
      try {
          const res = await fetch(`http://localhost:5000/api/admin/verifications/${companyId}/${action}`, { method: 'POST' });
          if (res.ok) {
              toast({ title: 'Success', description: `Company verification has been ${action}d.` });
              fetchVerifications(); // Refresh the list
              // notify other windows/components that a verification changed
              try { window.dispatchEvent(new CustomEvent('verification_updated', { detail: { companyId, action } })); } catch (e) {}
          } else {
              toast({ title: 'Error', description: `Failed to ${action} verification.`, variant: 'destructive' });
          }
      } catch (e) {
          console.error('Verification action failed', e);
          toast({ title: 'Network Error', description: 'Could not complete the action.', variant: 'destructive' });
      }
  };

  // Helper to normalize a stored document URL and open the preview dialog
  const openDocumentPreview = (url?: string | null, companyName?: string | null) => {
    if (!url) {
      try { toast({ title: 'No document', description: 'No document URL available.', variant: 'destructive' }); } catch (e) {}
      return;
    }
    let normalized = String(url).trim();
    try {
      // If it's a relative path like '/uploads/..' or 'uploads/..', prefix backend origin
      if (normalized.startsWith('/')) normalized = `http://localhost:5000${normalized}`;
      else if (!/^https?:\/\//i.test(normalized)) normalized = `http://localhost:5000/${normalized}`;
    } catch (e) {}
    setPreviewUrl(normalized);
    setPreviewCompanyName(companyName || null);
    setPreviewOpen(true);
  };

  // Download helper for preview URL (fetch blob and trigger download)
  const downloadPreview = async () => {
    if (!previewUrl) return toast({ title: 'No URL', description: 'No document to download.', variant: 'destructive' });
    try {
      const res = await fetch(previewUrl);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      // attempt to infer filename
      const parts = previewUrl.split('/');
      a.download = parts[parts.length - 1] || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Downloading', description: 'Your download has started.' });
    } catch (e) {
      console.error('Download failed', e);
      toast({ title: 'Download failed', description: 'Could not download document.', variant: 'destructive' });
    }
  };

  // expose debug handles for inspection in devtools
  useEffect(() => {
    try {
      (window as any).__admin_debug = { users, internships, stats, verifications };
    } catch (e) {}
    return () => { try { delete (window as any).__admin_debug; } catch (e) {} };
  }, [users, internships, stats, verifications]);

  const performInternshipAction = async (i:any, action:string) => {
    if (!i || !i.id) return;
    if (action === 'delete' && !confirm('Delete this internship?')) return;
    try {
      let url = `http://localhost:5000/api/internships/${i.id}`;
      let opts: any = { method: 'POST' };
      if (action === 'approve') url += '/approve';
      if (action === 'reject') url += '/reject';
      if (action === 'delete') opts = { method: 'DELETE' };
      const res = await fetch(url, opts);
      const success = res.ok;
      if (success) {
        toast({ title: 'Success', description: `Internship ${action}d successfully`, variant: 'default' });
        fetchInternships();
      } else {
        toast({ title: 'Error', description: `Failed to ${action} internship`, variant: 'destructive' });
      }
    } catch (e) { console.error(e); toast({ title: 'Error', description: `Failed to ${action} internship`, variant: 'destructive' }); }
  };

  const q = (searchTerm || '').toLowerCase();
  const filteredUsers = users.filter(user => {
    const name = ((user && (user.fullName || user.name)) || '').toString().toLowerCase();
    const email = ((user && user.email) || '').toString().toLowerCase();
    const type = ((user && (user.userType || user.type)) || '').toString().toLowerCase();
    return name.includes(q) || email.includes(q) || type.includes(q);
  });

  const filteredInternships = internships.filter(internship => {
    const title = ((internship && (internship.title || internship.position)) || '').toString().toLowerCase();
    const company = ((internship && (internship.company || internship.companyName)) || '').toString().toLowerCase();
    return title.includes(q) || company.includes(q);
  });

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              InternLink
            </h1>
            <p className="text-sm text-muted-foreground">Admin Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {user.fullName}
              </p>
              <p className="text-sm text-muted-foreground">Administrator</p>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Updated to grid-cols-5 after removing Settings tab */}
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="internships">Internships</TabsTrigger>
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Students</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeStudents}</div>
                  <p className="text-xs text-muted-foreground">Active accounts</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Companies</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeCompanies}</div>
                  <p className="text-xs text-muted-foreground">Verified partners</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Internships</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalInternships}</div>
                  <p className="text-xs text-muted-foreground">Total posted</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                  <p className="text-xs text-muted-foreground">Need approval</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Applications</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.thisMonthApplications}</div>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Latest platform activities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        activity.type === 'registration' ? 'bg-success' :
                        activity.type === 'approval' ? 'bg-primary' :
                        activity.type === 'moderation' ? 'bg-destructive' :
                        'bg-warning'
                      }`}></div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.details}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Quick Stats
                  </CardTitle>
                  <CardDescription>Platform performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm font-medium">Average Applications per Internship</span>
                    <span className="font-bold">34</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm font-medium">Student Success Rate</span>
                    <span className="font-bold">28%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm font-medium">Active Companies This Month</span>
                    <span className="font-bold">89</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <span className="text-sm font-medium">Platform Growth Rate</span>
                    <span className="font-bold text-success">+15%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">User Management</h2>
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Button variant="outline">Export Users</Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{user.fullName || user.name}</h3>
                          <Badge variant="outline">{user.userType || (user.type || 'Student')}</Badge>
                          <Badge className={getStatusColor(user.status || 'Active')}>
                            {user.status || 'Active'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Email:</span>
                            <span className="ml-2">{user.email}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Joined:</span>
                            <span className="ml-2">{user.joinDate || user.createdAt || ''}</span>
                          </div>
                          { (user.userType === 'student' || user.type === 'Student' || user.userType === undefined) && (
                            <>
                              <div>
                                <span className="text-muted-foreground">University:</span>
                                <span className="ml-2">{user.university || '—'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Applications:</span>
                                <span className="ml-2">{user.applications || 0}</span>
                              </div>
                            </>
                          )}
                          { (user.userType === 'company' || user.type === 'Company') && (
                            <>
                              <div>
                                <span className="text-muted-foreground">Representative:</span>
                                <span className="ml-2">{user.representative || user.companyName || '—'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Internships Posted:</span>
                                <span className="ml-2">{user.internshipsPosted || 0}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => viewProfile(user)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                        {user.status === "Active" ? (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => performUserAction(user, 'suspend')}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Suspend
                          </Button>
                        ) : (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => performUserAction(user, 'activate')}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Activate
                          </Button>
                        )}
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          {/* Internships Tab */}
          <TabsContent value="internships" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Internship Management</h2>
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search internships..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Button variant="outline">Filter by Status</Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredInternships.map((internship) => (
                <Card key={internship.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{internship.title}</h3>
                          <Badge className={getStatusColor(internship.status)}>
                            {internship.status}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground font-medium">
                          {internship.company}
                        </p>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Applications:</span>
                            <span className="ml-2 font-semibold">{internship.applications}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Location:</span>
                            <span className="ml-2">{internship.location}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stipend:</span>
                            <span className="ml-2">{internship.stipend}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Posted:</span>
                            <span className="ml-2">{internship.posted}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" onClick={() => viewInternship(internship)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        {internship.status === "Pending Approval" && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm"
                              onClick={() => performInternshipAction(internship, "approve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => performInternshipAction(internship, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => performInternshipAction(internship, 'delete')}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* NEW Company Verifications Tab */}
          <TabsContent value="verifications" className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Company Verification Requests</h2>
                <Badge variant="secondary">{verifications.length} Pending</Badge>
            </div>
            
            <div className="space-y-4">
                {verifications.length > 0 ? verifications.map((v) => (
                    <Card key={v.id} className="shadow-card">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg">{v.companyName}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Rep: {v.representative} ({v.email})
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Requested on: {formatDate(v.requestedAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => openDocumentPreview(v.documentUrl, v.companyName)}>
                                        <FileDown className="h-4 w-4 mr-2" />
                                        View Document
                                    </Button>
                                    <Button size="sm" onClick={() => handleVerificationAction(v.id, 'approve')}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Approve
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleVerificationAction(v.id, 'reject')}>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )) : (
                    <Card>
                        <CardContent className="p-10 text-center text-muted-foreground">
                            No pending verification requests.
                        </CardContent>
                    </Card>
                )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold">Platform Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Growth Trend</CardTitle>
                  <CardDescription>Key platform counts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Total Users</span>
                      <span className="font-semibold">{stats.totalUsers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active Students</span>
                      <span className="font-semibold">{stats.activeStudents || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active Companies</span>
                      <span className="font-semibold">{stats.activeCompanies || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Internships</span>
                      <span className="font-semibold">{stats.totalInternships || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Application Success Rates</CardTitle>
                  <CardDescription>Student application outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(() => {
                      const counts = (stats as any).applicationStatusCounts || { selected: 0, inReview: 0, rejected: 0, total: 0 };
                      const total = counts.total || (counts.selected + counts.inReview + counts.rejected) || 0;
                      const pct = (n:number) => (total === 0 ? 0 : Math.round((n/total)*100));
                      return (
                        <>
                          <div className="flex justify-between"><span>Selected</span><span className="text-success">{pct(counts.selected)}%</span></div>
                          <div className="flex justify-between"><span>In Review</span><span className="text-warning">{pct(counts.inReview)}%</span></div>
                          <div className="flex justify-between"><span>Rejected</span><span className="text-destructive">{pct(counts.rejected)}%</span></div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Universities</CardTitle>
                  <CardDescription>Most active student institutions</CardDescription>
                </CardHeader>
                <CardContent>
                  {((stats as any).topUniversities || []).length > 0 ? (
                    <div className="space-y-3">
                      {((stats as any).topUniversities || []).map((u:any)=> (
                        <div key={u.university} className="flex justify-between"><span>{u.university}</span><span className="font-semibold">{u.count} students</span></div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No university data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Companies</CardTitle>
                  <CardDescription>Most active hiring partners</CardDescription>
                </CardHeader>
                <CardContent>
                  {((stats as any).topCompanies || []).length > 0 ? (
                    <div className="space-y-3">
                      {((stats as any).topCompanies || []).map((c:any)=> (
                        <div key={c.company} className="flex justify-between"><span>{c.company}</span><span className="font-semibold">{c.count} internships</span></div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No company data</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Profile Dialog */}
      {selectedUser && (
        <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>User Profile</DialogTitle>
              <DialogDescription>
                Details and activity history for {selectedUser.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground">Name</span>
                <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground">Email</span>
                <p className="text-sm">{selectedUser.email}</p>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground">User Type</span>
                <Badge variant="outline" className="capitalize">{selectedUser.type}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground">Status</span>
                <Badge className={getStatusColor(selectedUser.status)}>
                  {selectedUser.status}
                </Badge>
              </div>
              {selectedUser.type === "Student" && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground">University</span>
                    <p className="text-sm">{selectedUser.university}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground">Applications</span>
                    <p className="text-sm">{selectedUser.applications}</p>
                  </div>
                </>
              )}
              {selectedUser.type === "Company" && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground">Representative</span>
                    <p className="text-sm">{selectedUser.representative}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-muted-foreground">Internships Posted</span>
                    <p className="text-sm">{selectedUser.internshipsPosted}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4">
              <Button 
                variant="destructive" 
                onClick={() => { deleteUser(selectedUser); setIsProfileOpen(false); }}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Internship Detail Dialog */}
      {selectedInternship && (
        <Dialog open={isInternshipOpen} onOpenChange={setIsInternshipOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Internship Details</DialogTitle>
              <DialogDescription>
                Details for {selectedInternship.title}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedInternship.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedInternship.company}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">Location</span>
                  <p className="text-sm">{selectedInternship.location || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Stipend</span>
                  <p className="text-sm">{selectedInternship.stipend || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="text-sm">{selectedInternship.status || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Applications</span>
                  <p className="text-sm">{selectedInternship.applications || 0}</p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground">Description</span>
                <p className="text-sm">{selectedInternship.description || selectedInternship.notes || 'No description provided.'}</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {selectedInternship.status === 'Pending Approval' && (
                <>
                  <Button onClick={() => { performInternshipAction(selectedInternship, 'approve'); closeInternship(); }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                  </Button>
                  <Button variant="destructive" onClick={() => { performInternshipAction(selectedInternship, 'reject'); closeInternship(); }}>
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </>
              )}
              <Button variant="destructive" onClick={() => { performInternshipAction(selectedInternship, 'delete'); closeInternship(); }}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button variant="outline" onClick={closeInternship}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Document preview dialog for verification files */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl sm:w-full">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>{previewCompanyName || 'Verification document'}</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {previewUrl ? (
              (/\.pdf$/i).test(previewUrl) ? (
                <div className="h-[70vh]">
                  <iframe src={previewUrl} className="w-full h-full border" title="Document Preview" />
                </div>
              ) : (/\.(png|jpe?g|gif|bmp)$/i).test(previewUrl) ? (
                <img src={previewUrl} alt="Document" className="w-full h-auto max-h-[70vh] object-contain" />
              ) : (
                <div className="p-4">
                  Unsupported document type. Please download the file to view it.
                </div>
              )
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No document selected for preview.
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button onClick={downloadPreview}>
              Download Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}