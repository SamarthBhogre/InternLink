import { useState, useEffect } from "react";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  FileText, 
  Eye,
  Send,
  Search,
  MapPin,
  DollarSign,
  Clock,
  Briefcase,
  LogOut,
  User as UserIcon,
  Settings,
  Award,
  TrendingUp,
  Star,
  Trash
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// --- PROPS INTERFACE ---
interface StudentDashboardProps {
  user: {
    fullName: string;
    email: string;
    university: string;
    course: string;
    yearOfStudy: string;
  };
  onLogout: () => void;
}

export function StudentDashboard({ user, onLogout }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const storageKey = `student_dashboard_${user.email}`;

  // --- MOCK DATA ---
  const applications = [
    { id: 1, company: "TechCorp Solutions", position: "Frontend Developer Intern", appliedDate: "2024-01-15", status: "In Review", location: "Mumbai, India", stipend: "₹25,000/month" },
    { id: 2, company: "InnovateLabs", position: "Data Science Intern", appliedDate: "2024-01-12", status: "Selected", location: "Bangalore, India", stipend: "₹30,000/month" },
    { id: 3, company: "StartupXYZ", position: "Marketing Intern", appliedDate: "2024-01-10", status: "Rejected", location: "Delhi, India", stipend: "₹15,000/month" }
  ];
  const availableInternships = [
    { id: 1, company: "Google", position: "Software Engineering Intern", location: "Hyderabad, India", stipend: "₹50,000/month", duration: "3 months", deadline: "2025-10-15", tags: ["React", "Node.js", "Python"] },
    { id: 2, company: "Microsoft", position: "AI/ML Research Intern", location: "Bangalore, India", stipend: "₹45,000/month", duration: "6 months", deadline: "2025-10-20", tags: ["Machine Learning", "Python", "TensorFlow"] },
    { id: 3, company: "Tata Motors", position: "Mechanical Engineer Intern", location: "Anumala, Gujarat", stipend: "₹40,000/month", duration: "4 months", deadline: "2025-10-10", tags: ["AutoCAD", "Mechanical", "Manufacturing"] }
  ];

  // --- STATE MANAGEMENT ---
  const [applicationsState, setApplicationsState] = useState<any[]>([]);
  const [availableInternshipsState, setAvailableInternshipsState] = useState<any[]>([]);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [profile, setProfile] = useState<any>({ ...user });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // --- HOOKS for data persistence ---
  // Hook: application and internships loading handled by consolidated loader below
  // (removed duplicate initial loader to avoid mock overrides)

  // Listen for platform internships updates (posted by companies)
  useEffect(() => {
    const onUpdate = () => {
      try {
        const raw = localStorage.getItem('platform_internships');
        if (raw) setAvailableInternshipsState(JSON.parse(raw));
      } catch (e) {}
    };
    window.addEventListener('platform_internships_updated', onUpdate as EventListener);
    return () => window.removeEventListener('platform_internships_updated', onUpdate as EventListener);
  }, []);

  // Expose applicationsState to the window for debugging in the browser console.
  // This avoids "ReferenceError: applicationsState is not defined" when inspecting from DevTools.
  useEffect(() => {
    try {
      (window as any).__internlink_applicationsState = applicationsState;
    } catch (e) {}
    return () => {
      try { delete (window as any).__internlink_applicationsState; } catch (e) {}
    };
  }, [applicationsState]);

  // --- Load applications from backend (with localStorage/mock fallback) ---
  const loadApplications = async () => {
    try {
      const url = `http://localhost:5000/api/applications?studentEmail=${encodeURIComponent(user.email)}`;
      console.debug('[StudentDashboard] loadApplications -> fetching', url);
      const res = await fetch(url);
      const text = await res.text();
      let d: any = null;
      try { d = text ? JSON.parse(text) : null; } catch (err) {
        console.debug('[StudentDashboard] loadApplications -> non-json response', text);
      }

      if (res.ok) {
        const list = (d && (d.applications || d.data || d)) || [];
        console.debug('[StudentDashboard] loadApplications -> parsed list length', (list || []).length, list);
        const normalized = (list || []).map((s: any) => {
          const src = s.application || s || {};
          return {
            id: src.id || src._id || String(src._id || src.id || Date.now()),
            position: src.internshipTitle || src.position || src.title || src.internship?.title || '',
            company: src.company || src.companyName || src.employer || src.internship?.company || '',
            appliedDate: src.appliedDate || src.applied || src.createdAt || (src._created && new Date(src._created).toISOString().split('T')[0]) || '',
            status: src.status || src.state || 'In Review',
            stipend: src.stipend || src.salary || src.internship?.stipend || src.internship?.salary || '',
            studentName: src.studentName || src.student?.name || src.applicant?.name || user.fullName,
            email: src.studentEmail || src.student?.email || src.email || user.email,
            phone: src.phone || src.student?.phone || ''
          };
        });

        setApplicationsState(normalized);
        try { localStorage.setItem('platform_applications', JSON.stringify(normalized)); } catch (e) {}
        return;
      } else {
        console.debug('[StudentDashboard] loadApplications -> server returned not ok', res.status, text);
      }
    } catch (e) {
      console.error('[StudentDashboard] Failed to fetch applications from server', e);
    }

    // fallback to localStorage or bundled mock
    try {
      const raw = localStorage.getItem('platform_applications');
      if (raw) { setApplicationsState(JSON.parse(raw)); return; }
    } catch (e) {}

    // Do not overwrite in-memory applications (e.g. recently applied) with bundled mock data.
    setApplicationsState((prev) => (prev && prev.length > 0 ? prev : applications));
  };

  // Load applications and internships on mount
  useEffect(() => {
    setProfile({ ...user });
    // DEBUG: remove stale cached applications so server data is used during development
    try {
      console.debug('[StudentDashboard] clearing cached platform_applications for fresh load');
      localStorage.removeItem('platform_applications');
    } catch (e) {}

    loadApplications();

    // Load internships from backend with local fallback
    async function loadInternships() {
      try {
        const res = await fetch('http://localhost:5000/api/internships');
        let list: any[] = [];
        if (res.ok) {
          const data = await res.json().catch(() => null);
          list = data?.internships || [];
        } else {
          const raw = localStorage.getItem('platform_internships');
          list = raw ? JSON.parse(raw) : availableInternships;
        }

        // Normalize shape so UI fields are consistent
        const normalized = (list || []).map((doc: any) => {
          const position = (doc.position || doc.title || '').toString();
          const company = (doc.company || doc.companyName || doc.companyEmail || '').toString();
          const stipend = (doc.stipend || doc.salary || doc.remuneration || '').toString();
          const location = (doc.location || doc.city || '').toString();
          const duration = (doc.duration || doc.period || '').toString();
          let tags: string[] = [];
          if (Array.isArray(doc.tags)) tags = doc.tags.map((t: any) => String(t));
          else if (doc.skills) {
            if (Array.isArray(doc.skills)) tags = doc.skills.map((t: any) => String(t));
            else tags = String(doc.skills).split(',').map(s => s.trim()).filter(Boolean);
          }
          return {
            ...doc,
            id: doc.id || doc._id || String(doc._id || doc.id || ''),
            position,
            company,
            stipend,
            location,
            duration,
            tags
          };
        });

        setAvailableInternshipsState(normalized);
        try { localStorage.setItem('platform_internships', JSON.stringify(normalized)); } catch (e) {}
      } catch (e) {
        try {
          const raw = localStorage.getItem('platform_internships');
          setAvailableInternshipsState(raw ? JSON.parse(raw) : availableInternships);
        } catch (err) {
          setAvailableInternshipsState(availableInternships);
        }
      }
    }
    loadInternships();

    // Load resume metadata from backend (if available) and hydrate profile + local fallback
    async function loadResumeMetadata() {
      const storageKey = `student_resume_${user.email}`;
      try {
        const url = `http://localhost:5000/api/resume?email=${encodeURIComponent(user.email)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const doc = data?.resume || data;
          if (doc && (doc.resumeUrl || doc.url || doc.storedFilename)) {
            const resumeUrl = doc.resumeUrl || doc.url || (doc.storedFilename ? `http://localhost:5000/uploads/${doc.storedFilename}` : '');
            const filename = doc.resumeFilename || doc.filename || '';
            setProfile((p:any) => ({ ...p, resumeFilename: filename, resumeUrl }));
            setResumeUploaded(true);
            try { localStorage.setItem(storageKey, JSON.stringify({ filename, url: resumeUrl })); } catch (e) {}
            return;
          }
        }
      } catch (e) {
        // ignore network errors and fall back to local storage
      }

      // fallback: try to read local storage entry
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const meta = JSON.parse(raw);
          setProfile((p:any) => ({ ...p, resumeFilename: meta.filename || meta.fileName || '', resumeUrl: meta.dataUrl || meta.url || '' }));
          setResumeUploaded(true);
        }
      } catch (e) {}
    }
    loadResumeMetadata();
  }, [user]);

  // Refresh applications when other parts of the app update them
  useEffect(() => {
    const handler = () => loadApplications();
    window.addEventListener('platform_applications_updated', handler as EventListener);
    return () => window.removeEventListener('platform_applications_updated', handler as EventListener);
  }, []);

  // --- DERIVED VALUES & HELPERS ---
  const totalApplications = applicationsState.length;
  const inReviewCount = applicationsState.filter((a) => a.status === "In Review").length;
  const selectedCount = applicationsState.filter((a) => a.status === "Selected").length;
  const rejectedCount = applicationsState.filter((a) => a.status === "Rejected").length;
  
  const profileFields = ["fullName", "email", "university", "course", "yearOfStudy"];
  const filledFields = profileFields.filter((f) => !!(profile as any)[f]).length;
  const profileCompletion = Math.round(((filledFields + (resumeUploaded ? 1 : 0)) / (profileFields.length + 1)) * 100);

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Selected": return "default";
      case "In Review": return "secondary";
      case "Rejected": return "destructive";
      default: return "outline";
    }
  };

  // Small helpers for formatting values coming from different backend shapes
  const formatDate = (d?: string) => {
    if (!d) return '—';
    // if value looks like an ObjectId string (24 hex chars), derive timestamp from it
    try {
      if (typeof d === 'string' && /^[0-9a-fA-F]{24}$/.test(d)) {
        const seconds = parseInt(d.substring(0, 8), 16);
        const dt = new Date(seconds * 1000);
        return dt.toLocaleDateString();
      }
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString();
    } catch (e) {
      return d;
    }
  };

  const formatStipend = (s?: string) => {
    if (!s) return '—';
    return String(s);
  };

  // Try to resolve stipend for an application from the application itself or matching internship
  const resolveStipendForApp = (app: any) => {
    const direct = app.stipend || app.salary || app.remuneration || app.internship?.stipend || app.internship?.salary;
    if (direct) return String(direct);
    // try to find matching internship loaded in state
    try {
      const iid = String(app.internshipId || app.internship?._id || app.internship?.id || app.internshipId || '');
      if (iid) {
        const found = availableInternshipsState.find((i: any) => String(i.id) === String(iid) || String(i._id || '') === String(iid));
        if (found) return String(found.stipend || found.salary || found.remuneration || '—');
      }
    } catch (e) {}
    return '—';
  };

  // Load resume metadata from backend (if available) and hydrate profile + local fallback
  async function loadResumeMetadata() {
    const storageKey = `student_resume_${user.email}`;
    try {
      const url = `http://localhost:5000/api/resume?email=${encodeURIComponent(user.email)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const doc = data?.resume || data;
        if (doc && (doc.resumeUrl || doc.url || doc.storedFilename)) {
          const resumeUrl = doc.resumeUrl || doc.url || (doc.storedFilename ? `http://localhost:5000/uploads/${doc.storedFilename}` : '');
          const filename = doc.resumeFilename || doc.filename || '';
          setProfile((p:any) => ({ ...p, resumeFilename: filename, resumeUrl }));
          setResumeUploaded(true);
          try { localStorage.setItem(storageKey, JSON.stringify({ filename, url: resumeUrl })); } catch (e) {}
          return;
        }
      }
    } catch (e) {
      // ignore network errors and fall back to local storage
    }

    // fallback: try to read local storage entry
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const meta = JSON.parse(raw);
        setProfile((p:any) => ({ ...p, resumeFilename: meta.filename || meta.fileName || '', resumeUrl: meta.dataUrl || meta.url || '' }));
        setResumeUploaded(true);
      }
    } catch (e) {}
  }

  const filteredInternships = availableInternshipsState.filter((internship: any) => {
    const q = (searchTerm || "").toLowerCase();
    const position = (internship.position || internship.title || "").toString().toLowerCase();
    const company = (internship.company || internship.companyName || "").toString().toLowerCase();
    const tags: string[] = Array.isArray(internship.tags)
      ? internship.tags
      : (internship.skills ? internship.skills.toString().split(',') : []);
    const tagsMatch = tags.some((tag: any) => (tag || "").toString().toLowerCase().includes(q));
    return (
      position.includes(q) ||
      company.includes(q) ||
      tagsMatch
    );
  });

  // --- HANDLERS ---
  const applyToInternship = async (internship: any) => {
    const internshipId = internship.id || internship._id;
    if (!internshipId) {
      toast({ title: 'Unable to apply', description: 'This internship is missing an id and cannot be applied to.' });
      return;
    }
    setApplyingId(internshipId);
    const payload = {
      internshipId: internshipId,
      studentEmail: user.email,
      studentName: user.fullName,
      company: internship.company || internship.companyName || "",
      internshipTitle: internship.position || internship.title || "",
      university: (user as any).university || '',
      course: (user as any).course || '',
      year: (user as any).yearOfStudy || '',
      phone: (user as any).phone || ''
    };

    try {
      console.debug('[StudentDashboard] applyToInternship -> POST', payload);
      const res = await fetch('http://localhost:5000/api/applications', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch (err) { console.debug('[StudentDashboard] applyToInternship -> non-json response', text); }

      console.debug('[StudentDashboard] applyToInternship -> response', res.status, data || text);

      if (res.ok) {
        const nowDate = new Date().toISOString().split('T')[0];
        const stipendFromResp = data?.application?.stipend || data?.stipend || '';
        const stipend = stipendFromResp || internship.stipend || internship.salary || '';

        // create unified application shape used by both student and company UIs
        const app = {
          id: data?.application?.id || data?.id || String(Date.now()),
          internshipId: internshipId,
          internshipTitle: payload.internshipTitle,
          // student-facing fields
          position: internship.position || internship.title || payload.internshipTitle,
          company: internship.company || internship.companyName || payload.company,
          appliedDate: nowDate,
          status: data?.application?.status || data?.status || 'In Review',
          stipend,
          // company-facing fields
          studentName: payload.studentName,
          email: payload.studentEmail,
          phone: (user as any).phone || '',
          university: (user as any).university || '',
          course: (user as any).course || '',
          year: (user as any).yearOfStudy || ''
        };

        setApplicationsState(prev => [app, ...prev]);
        try {
          const raw = localStorage.getItem('platform_applications');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(app);
          localStorage.setItem('platform_applications', JSON.stringify(list));
        } catch (e) {}

        // refresh from server in case backend returns a different canonical shape
        setTimeout(() => { try { loadApplications(); } catch (e) {} }, 400);

        window.dispatchEvent(new CustomEvent('platform_applications_updated'));
        toast({ title: "Application Sent!", description: `Successfully applied to ${payload.internshipTitle}.` });
        // show applications tab so user sees the new application
        setActiveTab('applications');
      } else {
        console.error('Server rejected application', data || text);
        toast({ title: 'Application failed', description: (data && (data.error || data.message)) || 'Server rejected the application.' });
      }
    } catch (e) {
      console.error('Network error applying to internship', e);
      toast({ title: 'Network error', description: 'Could not reach server. Try again later.' });
    } finally {
      setApplyingId(null);
    }
  };

  // Add delete (take back) handler for students to remove their own application
  const deleteApplication = async (appId: string) => {
    if (!appId) return;
    if (!window.confirm('Take back this application? This will remove it from your applications.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/applications/${encodeURIComponent(String(appId))}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // remove from local state
        setApplicationsState(prev => prev.filter(a => String(a.id) !== String(appId)));
        // update localStorage fallback
        try {
          const raw = localStorage.getItem('platform_applications');
          if (raw) {
            const list = JSON.parse(raw).filter((x:any) => String(x.id) !== String(appId));
            localStorage.setItem('platform_applications', JSON.stringify(list));
          }
        } catch (e) { /* ignore */ }
        window.dispatchEvent(new CustomEvent('platform_applications_updated'));
        toast({ title: 'Taken back', description: 'Your application has been removed.' });
      } else {
        toast({ title: 'Failed', description: data?.msg || data?.error || `Status ${res.status}` });
      }
    } catch (e) {
      console.error('Delete application failed', e);
      toast({ title: 'Network error', description: 'Could not take back application. Try again.' });
    }
  };

  // --- Resume upload handlers: attempts backend upload, falls back to localStorage (base64) ---
  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const storageKey = `student_resume_${user.email}`;
    const filename = file.name;

    // Try uploading to backend endpoint first
    try {
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('email', user.email);

      const res = await fetch('http://localhost:5000/api/upload_resume', {
        method: 'POST',
        body: fd
      });

      if (res.ok) {
        const body = await res.json().catch(() => null);
        const url = body?.url || body?.path || '';
        // store a small reference locally so UI can show status
        const resumeMeta = { filename, url };
        try { localStorage.setItem(storageKey, JSON.stringify(resumeMeta)); } catch (err) {}
        setProfile((p:any) => ({ ...p, resumeFilename: filename, resumeUrl: url }));
        setResumeUploaded(true);
        toast({ title: 'Resume uploaded', description: `${filename} uploaded successfully.` });
        return;
      }
    } catch (err) {
      console.debug('[StudentDashboard] resume upload failed, falling back to local storage', err);
    }

    // Fallback: read file as base64 and store in localStorage
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const payload = { filename, dataUrl: base64 };
        try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch (e) {}
        setProfile((p:any) => ({ ...p, resumeFilename: filename, resumeUrl: base64 }));
        setResumeUploaded(true);
        toast({ title: 'Resume saved locally', description: `${filename} saved to browser storage.` });
      };
      reader.onerror = () => {
        toast({ title: 'Failed', description: 'Could not read the selected file.' });
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Resume fallback failed', e);
      toast({ title: 'Failed', description: 'Could not save resume.' });
    }
  };

  const downloadResume = () => {
    const storageKey = `student_resume_${user.email}`;
    try {
      // Prefer server/profile stored URL first
      if ((profile as any).resumeUrl) {
        const url = (profile as any).resumeUrl;
        if (url.startsWith('data:')) {
          const a = document.createElement('a');
          a.href = url;
          a.download = (profile as any).resumeFilename || `resume_${user.email}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          window.open(url, '_blank');
        }
        return;
      }

      // Then check localStorage entry
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const meta = JSON.parse(raw);
        if ((meta.dataUrl || meta.url) && (meta.dataUrl || meta.url).startsWith('data:')) {
          const a = document.createElement('a');
          a.href = meta.dataUrl || meta.url;
          a.download = meta.filename || `resume_${user.email}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        if (meta.url) {
          window.open(meta.url, '_blank');
          return;
        }
      }

      toast({ title: 'Not found', description: 'No resume is available to download.' });
    } catch (e) {
      console.error('Download resume failed', e);
      toast({ title: 'Failed', description: 'Could not download resume.' });
    }
  };

  const removeResume = async () => {
    if (!window.confirm('Remove uploaded resume?')) return;
    const storageKey = `student_resume_${user.email}`;
    try {
      // attempt backend delete (best-effort)
      await fetch('http://localhost:5000/api/upload_resume', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }) }).catch(() => null);
    } catch (e) {}
    try { localStorage.removeItem(storageKey); } catch (e) {}
    setProfile((p:any) => ({ ...p, resumeFilename: undefined, resumeUrl: undefined }));
    setResumeUploaded(false);
    toast({ title: 'Removed', description: 'Resume removed.' });
  };

  const saveProfileEdits = () => {
    setIsEditingProfile(false);
    // Here you would also update the user object in your parent component or global state
    toast({ title: "Profile Updated", description: "Your changes have been saved successfully." });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* ====== HEADER: Matched to Company Dashboard Style ====== */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              InternLink
            </h1>
            <p className="text-sm text-muted-foreground">Student Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{user.fullName}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applications">My Applications</TabsTrigger>
            <TabsTrigger value="internships">Find Internships</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          {/* ====== OVERVIEW TAB: Redesigned to match Company Dashboard Layout ====== */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome back, {user.fullName.split(' ')[0]}! 👋</CardTitle>
                    <CardDescription>Here's a quick summary of your internship hunt.</CardDescription>
                </CardHeader>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalApplications}</div>
                        <p className="text-xs text-muted-foreground">Keep up the momentum!</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Review</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{inReviewCount}</div>
                        <p className="text-xs text-muted-foreground">Companies are viewing.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Offers Received</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{selectedCount}</div>
                        <p className="text-xs text-muted-foreground">Congratulations!</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Profile Completion</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold mb-2">{profileCompletion}%</div>
                        <Progress value={profileCompletion} className="h-2" />
                    </CardContent>
                </Card>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5"/>
                            Application Status
                        </CardTitle>
                        <CardDescription>A breakdown of your application outcomes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>Selected</span>
                            <span className="font-semibold">{selectedCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div>In Review</span>
                            <span className="font-semibold">{inReviewCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div>Rejected</span>
                            <span className="font-semibold">{rejectedCount}</span>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5"/>
                            Recommended For You
                        </CardTitle>
                        <CardDescription>Internships matching your profile.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       {availableInternshipsState.slice(0, 2).map(internship => (
                         <div key={internship.id} className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{internship.position}</p>
                                <p className="text-sm text-muted-foreground">{internship.company}</p>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => applyToInternship(internship)}>Apply</Button>
                         </div>
                       ))}
                       <Button variant="outline" className="w-full" onClick={() => setActiveTab('internships')}>View More</Button>
                    </CardContent>
                </Card>
            </div>
          </TabsContent>

          {/* ====== APPLICATIONS TAB: Rebuilt with a clean Table ====== */}
          <TabsContent value="applications">
            <Card>
              <CardHeader>
                <CardTitle>My Applications</CardTitle>
                <CardDescription>Track the status of all your internship applications here.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Position</TableHead>
                      <TableHead>Applied On</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Stipend</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicationsState.length > 0 ? applicationsState.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="font-semibold">{app.position || app.internshipTitle || 'Untitled'}</span>
                            <span className="text-sm text-muted-foreground">{app.company || ''}</span>
                          </div>
                        </TableCell>
                        {/* Attempt common fields, fall back to application id (ObjectId timestamp) */}
                        <TableCell>{formatDate(app.appliedDate || app.applied || app.createdAt || app.appliedOn || app.applied_at || app.id)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(app.status || app.state || 'In Review')}>{app.status || app.state || 'In Review'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatStipend(resolveStipendForApp(app))}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => deleteApplication(app.id)}>
                            <Trash className="h-4 w-4 mr-2" />
                            Take back
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No applications found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== INTERNSHIPS TAB: Added Search Bar ====== */}
          <TabsContent value="internships" className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, company, or skill..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInternships.length > 0 ? filteredInternships.map((internship) => (
                <Card key={internship.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">{internship.position}</CardTitle>
                    <CardDescription>{internship.company}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-grow">
                    <div className="text-sm text-muted-foreground space-y-2">
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {internship.location}</div>
                        <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> {internship.stipend}</div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {internship.duration}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {internship.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                  <div className="p-6 pt-0">
                     <Button className="w-full" onClick={() => applyToInternship(internship)}>Apply Now</Button>
                  </div>
                </Card>
              )) : (
                 <p className="col-span-full text-center text-muted-foreground py-10">No internships match your search.</p>
              )}
            </div>
          </TabsContent>

          {/* ====== PROFILE TAB: Combined View and Edit into one Card ====== */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Manage your profile details.</CardDescription>
                </div>
                {!isEditingProfile && <Button variant="outline" onClick={() => setIsEditingProfile(true)}>Edit Profile</Button>}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resume section: upload / download / remove */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-muted-foreground">Resume</label>
                  <div className="col-span-2 flex items-center gap-2">
                    <input id="resumeInput" type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleResumeChange} />
                    <span className="text-sm font-semibold">{(profile as any).resumeFilename || (resumeUploaded ? 'Uploaded' : 'No resume uploaded')}</span>
                    <Button variant="ghost" size="sm" onClick={() => (document.getElementById('resumeInput') as HTMLInputElement)?.click()}>Upload</Button>
                    <Button variant="outline" size="sm" onClick={downloadResume}>Download</Button>
                    <Button variant="destructive" size="sm" onClick={removeResume}>Remove</Button>
                  </div>
                </div>
                {profileFields.map((field) => (
                  <div key={field} className="grid grid-cols-3 items-center gap-4">
                    <label className="text-sm font-medium text-muted-foreground capitalize">
                      {field.replace(/([A-Z])/g, " $1")}
                    </label>
                    {isEditingProfile ? (
                      <Input
                        type="text"
                        value={(profile as any)[field] || ""}
                        onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
                        className="col-span-2"
                      />
                    ) : (
                      <p className="col-span-2 text-sm font-semibold">{(profile as any)[field] || "—"}</p>
                    )}
                  </div>
                ))}
                {isEditingProfile && (
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="ghost" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                    <Button onClick={saveProfileEdits}>Save Changes</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

