import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus,
  Users, 
  FileText, 
  MapPin, 
  Clock, 
  DollarSign, 
  Eye,
  Download,
  Calendar,
  TrendingUp,
  Building,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  UserCheck,
  ShieldCheck, // <-- Import new icon
  Trash // <-- Import Trash for delete action
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CompanyDashboardProps {
  user: {
    fullName: string;
    email: string;
    companyName: string;
    designation: string;
    phone?: string;
    linkedin?: string;
  };
  onLogout: () => void;
}

export function CompanyDashboard({ user, onLogout }: CompanyDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [isPostingInternship, setIsPostingInternship] = useState(false);
  const [postForm, setPostForm] = useState<any>({ title: '', duration: '', location: '', stipend: '', skills: '', description: '', deadline: '' });
  const [postedInternshipsState, setPostedInternshipsState] = useState<any[]>([]);
  const [applicationsState, setApplicationsState] = useState<any[]>([]);
  // company overview counts (fetched from backend /api/company/overview)
  const [companyOverview, setCompanyOverview] = useState<any>({ activeInternships: 0, totalApplications: 0, selected: 0, pending: 0 });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [selectedInternshipFilter, setSelectedInternshipFilter] = useState<string | null>(null);
  const [isEditingInternship, setIsEditingInternship] = useState(false);
  const [editInternshipId, setEditInternshipId] = useState<string | null>(null);
  // local editable copy of company profile
  const [localUser, setLocalUser] = useState<any>(user);
  const [isCompanyEditing, setIsCompanyEditing] = useState(false);
  const [companyForm, setCompanyForm] = useState<any>({ fullName: user.fullName || '', companyName: user.companyName || '', designation: user.designation || '', email: user.email || '', phone: user.phone || '', linkedin: user.linkedin || '' });
  
  // New state for verification page
  const [verificationStatus, setVerificationStatus] = useState('Not Verified'); // Could be 'Not Verified', 'Pending Review', 'Verified'
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationDocumentUrl, setVerificationDocumentUrl] = useState<string | null>(null);

  // resume preview modal state
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);


  // Load internships and applications from backend (or local fallback)
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('http://localhost:5000/api/internships');
        if (res.ok) {
          const data = await res.json();
          setPostedInternshipsState(data.internships || []);
        } else {
          setPostedInternshipsState([]);
        }
      } catch (e) {
        // fallback to local/mock
        try {
          const raw = localStorage.getItem('platform_internships');
          setPostedInternshipsState(raw ? JSON.parse(raw) : []);
        } catch (e) {
          setPostedInternshipsState([]);
        }
      }

      try {
        const q = encodeURIComponent(user.companyName || user.email || '');
        const res2 = await fetch(`http://localhost:5000/api/applications?company=${q}`);
        if (res2.ok) {
          const d2 = await res2.json();
          const apps = (d2.applications || []).map((a:any) => normalizeApplication(a));
          setApplicationsState(apps);
        } else {
          setApplicationsState([]);
        }
      } catch (e) {
        try {
          const raw = localStorage.getItem('platform_applications');
          const parsed = raw ? JSON.parse(raw) : [];
          setApplicationsState(parsed.map((a:any)=>normalizeApplication(a)));
        } catch (e) {
          setApplicationsState([]);
        }
      }
    }
    load();
  }, []);

  // fetch company overview (aggregated counts)
  useEffect(() => {
    const fetchOverview = async () => {
      const companyKey = encodeURIComponent(user.companyName || user.email || '');
      try {
        const res = await fetch(`http://localhost:5000/api/company/overview?company=${companyKey}`);
        if (res.ok) {
          const d = await res.json();
          setCompanyOverview({
            activeInternships: d.activeInternships ?? d.totalInternships ?? 0,
            totalApplications: d.totalApplications ?? d.applicationStatusCounts?.total ?? 0,
            selected: d.applicationStatusCounts?.selected ?? 0,
            pending: d.applicationStatusCounts?.inReview ?? 0
          });
          return;
        }
      } catch (e) {
        console.error('Failed to load company overview', e);
      }
      // fallback to compute from local state
      setCompanyOverview({
        activeInternships: postedInternshipsState.filter((x:any) => ((x.status||'').toString().toLowerCase() === 'active')).length,
        totalApplications: applicationsState.length,
        selected: applicationsState.filter((a:any) => (a.status||'').toString().toLowerCase() === 'selected').length,
        pending: applicationsState.filter((a:any) => ['in review','pending'].includes((a.status||'').toString().toLowerCase())).length
      });
    };
    if (user) fetchOverview();
  }, [user, postedInternshipsState, applicationsState]);

  // helper to create a consistent application shape
  const normalizeApplication = (a:any) => {
    // handle nested wrapper (e.g., { application: { ... } })
    const src = a && a.application ? a.application : a;
    const studentObj = src.student || src.applicant || {};
    return {
      id: src.id || src._id || (src._id && String(src._id)) || String(src.id) || String(Date.now()),
      internshipId: src.internshipId || src.internship || src.jobId || null,
      internshipTitle: src.internshipTitle || src.position || src.title || '',
      position: src.position || src.internshipTitle || src.title || '',
      company: src.company || src.companyName || '',
      appliedDate: src.appliedDate || src.applied || src.createdAt || (src._created && new Date(src._created).toISOString().split('T')[0]) || '',
      status: src.status || src.state || 'In Review',
      stipend: src.stipend || src.salary || '',
      studentName: src.studentName || studentObj.name || studentObj.fullName || src.name || src.fullName || '',
      email: src.studentEmail || studentObj.email || src.email || '',
      phone: src.phone || studentObj.phone || '',
      university: src.university || studentObj.university || '',
      course: src.course || studentObj.course || '',
      year: src.year || studentObj.year || src.yearOfStudy || ''
    };
  };

  // update handler for platform events: normalize stored list
  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('platform_applications');
        if (raw) {
          const parsed = JSON.parse(raw);
          setApplicationsState(parsed.map((a:any)=>normalizeApplication(a)));
        }
      } catch (e) {}
    };
    window.addEventListener('platform_applications_updated', handler as EventListener);
    window.addEventListener('platform_internships_updated', handler as EventListener);
    return () => {
      window.removeEventListener('platform_applications_updated', handler as EventListener);
      window.removeEventListener('platform_internships_updated', handler as EventListener);
    };
  }, []);

  const postInternship = async () => {
    const payload = {
      title: postForm.title || 'Untitled',
      company: user.companyName || user.fullName,
      companyEmail: user.email,
      duration: postForm.duration,
      location: postForm.location,
      stipend: postForm.stipend,
      tags: postForm.skills ? postForm.skills.split(',').map((s:string)=>s.trim()) : [],
      description: postForm.description,
      deadline: postForm.deadline,
      posted: new Date().toLocaleDateString()
    };
    try {
      const res = await fetch('http://localhost:5000/api/internships', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (res.ok) {
        const internship = data?.internship ?? data;
        if (!internship) {
          console.error('Post succeeded but returned unexpected payload:', data);
          toast({ title: 'Post failed', description: 'Server returned unexpected response. Check console for details.' });
          return;
        }

        // update local state
        setPostedInternshipsState(prev => [internship, ...prev]);
        // also persist platform internships for students fallback
        try {
          const raw = localStorage.getItem('platform_internships');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(internship);
          localStorage.setItem('platform_internships', JSON.stringify(list));
        } catch (e) { console.error('Failed to persist platform_internships fallback', e); }
        // notify user and UI
        toast({ title: 'Internship posted', description: 'Your internship was posted successfully.' });
        window.dispatchEvent(new CustomEvent('platform_internships_updated'));
        // reset form and close dialog
        setPostForm({ title: '', duration: '', location: '', stipend: '', skills: '', description: '', deadline: '' });
        setIsPostingInternship(false);
      } else {
        console.error('Post failed', res.status, data);
        const msg = data?.error || data?.message || data?.raw || `Status ${res.status}`;
        toast({ title: 'Post failed', description: String(msg) });
      }
    } catch (e) {
      console.error('Network or runtime error while posting internship', e);
      toast({ title: 'Error', description: 'An error occurred while posting internship.' });
    }
  };

  const updateInternship = async () => {
    if (!editInternshipId) return;
    const payload = {
      title: postForm.title || 'Untitled',
      company: user.companyName || user.fullName,
      companyEmail: user.email,
      duration: postForm.duration,
      location: postForm.location,
      stipend: postForm.stipend,
      tags: postForm.skills ? postForm.skills.split(',').map((s:string)=>s.trim()) : [],
      description: postForm.description,
      deadline: postForm.deadline
    };
    try {
      const res = await fetch(`http://localhost:5000/api/internships/${editInternshipId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });

      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

      if (res.ok) {
        const internship = data?.internship ?? data;
        // update local state
        setPostedInternshipsState(prev => prev.map(i => (i.id === editInternshipId || i._id === editInternshipId) ? internship || {...i, ...payload} : i));
        // persist to fallback
        try {
          const raw = localStorage.getItem('platform_internships');
          const list = raw ? JSON.parse(raw) : [];
          const idx = list.findIndex((x:any)=>x.id === editInternshipId || x._id === editInternshipId);
          if (idx > -1) { list[idx] = internship || {...list[idx], ...payload}; localStorage.setItem('platform_internships', JSON.stringify(list)); }
        } catch (e) { console.error('Failed to persist updated internship to fallback', e); }
        window.dispatchEvent(new CustomEvent('platform_internships_updated'));
        toast({ title: 'Updated', description: 'Internship updated successfully.' });
        setIsPostingInternship(false);
        setIsEditingInternship(false);
        setEditInternshipId(null);
      } else {
        console.error('Update failed', res.status, data);
        const msg = data?.error || data?.message || data?.raw || `Status ${res.status}`;
        toast({ title: 'Update failed', description: String(msg) });
      }
    } catch (e) { console.error('Network or runtime error while updating internship', e); toast({ title: 'Error', description: 'An error occurred while updating internship.' }); }
  };

  const updateApplicationStatus = async (appId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/applications/${appId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        // update local state
        setApplicationsState(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        try {
          const raw = localStorage.getItem('platform_applications');
          const list = raw ? JSON.parse(raw) : [];
          const idx = list.findIndex((x:any)=>x.id === appId || x.id === parseInt(appId));
          if (idx > -1) { list[idx].status = newStatus; localStorage.setItem('platform_applications', JSON.stringify(list)); }
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('platform_applications_updated'));
      }
    } catch (e) { console.error(e); }
  };

  // Add delete handler for applications (company or student can call this)
  const deleteApplication = async (appId: string) => {
    if (!appId) return;
    if (!window.confirm('Delete this application? This action cannot be undone.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/applications/${encodeURIComponent(String(appId))}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // remove from local state
        setApplicationsState(prev => prev.filter(a => String(a.id) !== String(appId)));
        // persist removal from fallback storage
        try {
          const raw = localStorage.getItem('platform_applications');
          if (raw) {
            const list = JSON.parse(raw).filter((x:any) => String(x.id) !== String(appId));
            localStorage.setItem('platform_applications', JSON.stringify(list));
          }
        } catch (e) { /* ignore */ }
        window.dispatchEvent(new CustomEvent('platform_applications_updated'));
        toast({ title: 'Deleted', description: 'Application removed.' });
      } else {
        toast({ title: 'Delete failed', description: data?.msg || data?.error || `Status ${res.status}` });
      }
    } catch (e) {
      console.error('Delete application failed', e);
      toast({ title: 'Network error', description: 'Could not delete application. Try again.' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "selected":
      case "verified":
          return "bg-success text-success-foreground";
      case "closed":
          return "bg-muted text-muted-foreground";
      case "pending":
      case "pending review":
          return "bg-warning text-warning-foreground";
      case "rejected":
      case "not verified":
          return "bg-destructive text-destructive-foreground";
      default:
          return "bg-muted text-muted-foreground";
    }
  };


  const openEditDialog = (internship: any) => {
    setPostForm({
      title: internship.title || internship.position || '',
      duration: internship.duration || '',
      location: internship.location || '',
      stipend: internship.stipend || '',
      skills: internship.tags ? internship.tags.join(',') : (internship.skills || ''),
      description: internship.description || '',
      deadline: internship.deadline || ''
    });
    setEditInternshipId(internship.id || internship._id || null);
    setIsEditingInternship(true);
    setIsPostingInternship(true);
  };

  const openProfile = async (application: any) => {
    let norm = normalizeApplication(application);

    // If fields missing, try fetching the authoritative application by id
    if ((!norm.studentName || !norm.email) && norm.id) {
      try {
        const res = await fetch(`http://localhost:5000/api/applications/${encodeURIComponent(String(norm.id))}`);
        if (res.ok) {
          const d = await res.json();
          if (d && d.application) {
            norm = normalizeApplication(d.application);
            // update local list state if present
            setApplicationsState(prev => {
              const idx = prev.findIndex((p:any) => String(p.id) === String(norm.id));
              if (idx > -1) { const copy = [...prev]; copy[idx] = norm; return copy; }
              return prev;
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch single application', e);
      }
    }

    // fallback: try server-wide fetch by company if id fetch didn't provide student details
    if ((!norm.studentName || !norm.email) && user) {
      try {
        const q = encodeURIComponent(user.companyName || user.email || '');
        const res = await fetch(`http://localhost:5000/api/applications?company=${q}`);
        if (res.ok) {
          const d = await res.json();
          const apps = (d.applications || []).map((x:any) => normalizeApplication(x));
          setApplicationsState(apps);
          const found = apps.find((x:any) => String(x.id) === String(norm.id) || String((x as any)._id || '') === String(norm.id));
          if (found) norm = found;
        }
      } catch (e) {
        console.error('Failed to refresh application when opening profile', e);
      }
    }

    // final fallback: try reading persisted platform_applications from localStorage
    if ((!norm.studentName || !norm.email)) {
      try {
        const raw = localStorage.getItem('platform_applications');
        if (raw) {
          const parsed = JSON.parse(raw);
          const foundLocal = (parsed || []).map((x:any) => normalizeApplication(x)).find((x:any) => String(x.id) === String(norm.id) || String((x as any)._id || '') === String(norm.id));
          if (foundLocal) norm = foundLocal;
        }
      } catch (e) {
        console.error('Failed to read platform_applications fallback when opening profile', e);
      }
    }

    setSelectedApplication(norm);
    setIsProfileOpen(true);
  };

  // View resume handler: try application-level URL first, then query backend by email
  const viewResume = async (application: any) => {
    const email = application?.email || application?.studentEmail || application?.student?.email;
    setResumeError(null);
    setResumeUrl(null);
    setResumeLoading(true);
    setResumeModalOpen(true);

    const normalizeUrl = (u: string | null) => {
      if (!u) return u;
      // data URLs and absolute http(s) are fine
      if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u;
      if (u.startsWith('//')) return window.location.protocol + u;
      // If URL is relative (starts with /uploads/...), prefix backend origin
      if (u.startsWith('/')) return `http://localhost:5000${u}`;
      return `http://localhost:5000/${u}`;
    };

    try {
      // prefer any resume URL embedded in the application object
      const candidateUrl = application?.resumeUrl || application?.student?.resumeUrl || application?.resume || application?.student?.resume;
      if (candidateUrl) {
        setResumeUrl(normalizeUrl(candidateUrl));
        return;
      }

      if (!email) {
        setResumeError('No student email available to fetch resume.');
        return;
      }

      const res = await fetch(`http://localhost:5000/api/resume?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        // try to parse error body for debug
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || `Status ${res.status}`);
      }

      const data = await res.json().catch(()=>null);
      // backend might return different shapes. handle multiple possibilities
      let url = data?.resumeUrl || data?.url || data?.resume?.resumeUrl || (data?.resume && data.resume.storedFilename ? `http://localhost:5000/uploads/${data.resume.storedFilename}` : null) || (data?.storedFilename ? `http://localhost:5000/uploads/${data.storedFilename}` : null) || null;
      if (!url) {
        setResumeError('No resume found for this user.');
      } else {
        setResumeUrl(normalizeUrl(url));
      }
    } catch (err:any) {
      console.error('Failed to load resume', err);
      setResumeError(err?.message || 'Failed to load resume.');
    } finally {
      setResumeLoading(false);
    }
  };

  // keep local form in sync when parent user prop changes
  useEffect(() => {
    setLocalUser(user);
    setCompanyForm({ fullName: user.fullName || '', companyName: user.companyName || '', designation: user.designation || '', email: user.email || '', phone: user.phone || '', linkedin: user.linkedin || '' });
  }, [user]);

  const saveCompanyProfile = async () => {
    const payload = {
      email: user.email,
      fullName: companyForm.fullName,
      companyName: companyForm.companyName,
      designation: companyForm.designation,
      phone: companyForm.phone,
      linkedin: companyForm.linkedin
    };
    try {
      const res = await fetch('http://localhost:5000/api/users/by-email', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast({ title: 'Company profile updated', description: 'Your company profile was saved.' });
        // update local display copy
        setLocalUser((prev:any) => ({ ...prev, ...payload }));
        setIsCompanyEditing(false);
      } else {
        console.error('Failed updating company profile', data);
        toast({ title: 'Update failed', description: data?.error || 'Could not update company profile.' });
      }
    } catch (e) {
      console.error('Network error updating company profile', e);
      toast({ title: 'Network error', description: 'Could not reach server. Try again later.' });
    }
  };

  // Fetch persisted verification status and document URL from backend on mount
  useEffect(() => {
    const loadVerificationStatus = async () => {
      if (!user || !user.email) return;
      const emailParam = encodeURIComponent(user.email);
      // Try companies endpoint first
      try {
        const res = await fetch(`http://localhost:5000/api/companies/by-email?email=${emailParam}`);
        if (res.ok) {
          const d = await res.json().catch(() => null);
          const company = d?.company || d || null;
          if (company) {
            const s = company.verificationStatus || company.verification_status || company.status || null;
            const url = company.verificationDocumentUrl || company.documentUrl || company.verificationDocumentUrl || null;
            if (s) setVerificationStatus((s === 'Pending' || s === 'Pending Review') ? 'Pending Review' : (s === 'Verified' ? 'Verified' : 'Not Verified'));
            if (url) setVerificationDocumentUrl(url);
            return;
          }
        }
      } catch (e) {
        console.error('companies/by-email fetch failed', e);
      }

      // Fallback: query users list for this email and read verification fields
      try {
        const res2 = await fetch(`http://localhost:5000/api/users?q=${emailParam}`);
        if (res2.ok) {
          const d2 = await res2.json().catch(() => null);
          const list = d2?.users || d2 || [];
          const found = (Array.isArray(list) ? list.find((u:any) => (u.email || '').toLowerCase() === (user.email || '').toLowerCase()) : null);
          if (found) {
            const s2 = found.verificationStatus || found.verification_status || found.status || null;
            const url2 = found.verificationDocumentUrl || found.documentUrl || null;
            if (s2) setVerificationStatus((s2 === 'Pending' || s2 === 'Pending Review') ? 'Pending Review' : (s2 === 'Verified' ? 'Verified' : 'Not Verified'));
            if (url2) setVerificationDocumentUrl(url2);
          }
        }
      } catch (e) {
        console.error('users query fallback failed', e);
      }
    };
    loadVerificationStatus();
  }, [user]);

  // Handler for verification file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setVerificationFile(event.target.files[0]);
    }
  };

  // Handler for verification submission
  const handleVerificationSubmit = async () => {
    if (!verificationFile && !companyForm.linkedin) {
      toast({ title: 'No file or LinkedIn provided', description: 'Please upload a document or provide LinkedIn link.', variant: 'destructive' });
      return;
    }
    try {
      let res;
      if (verificationFile) {
        const fd = new FormData();
        fd.append('email', user.email);
        fd.append('linkedin', companyForm.linkedin || '');
        fd.append('document', verificationFile);
        res = await fetch('http://localhost:5000/api/company/verify', { method: 'POST', body: fd });
      } else {
        const payload: any = { email: user.email, linkedin: companyForm.linkedin };
        res = await fetch('http://localhost:5000/api/company/verify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }

      const data = await res.json().catch(()=>null);
      if (res.ok) {
        setVerificationStatus('Pending Review');
        toast({ title: 'Submitted', description: 'Verification request submitted.' });
      } else {
        toast({ title: 'Submission failed', description: data?.msg || 'Failed to submit verification.' });
      }
    } catch (e) {
      console.error('Verification submit failed', e);
      toast({ title: 'Error', description: 'Failed to submit verification.' });
    }
  };

  useEffect(() => {
    const refresh = () => {
      // reload verification status from server
      (async () => {
        if (!user || !user.email) return;
        const emailParam = encodeURIComponent(user.email);
        try {
          const res = await fetch(`http://localhost:5000/api/companies/by-email?email=${emailParam}`);
          if (res.ok) {
            const d = await res.json().catch(() => null);
            const company = d?.company || d || null;
            if (company) {
              const s = company.verificationStatus || company.verification_status || company.status || null;
              const url = company.verificationDocumentUrl || company.documentUrl || company.verificationDocumentUrl || null;
              if (s) setVerificationStatus((s === 'Pending' || s === 'Pending Review') ? 'Pending Review' : (s === 'Verified' ? 'Verified' : 'Not Verified'));
              if (url) setVerificationDocumentUrl(url);
              return;
            }
          }
        } catch (e) {}
      })();
    };

    const handler = () => refresh();
    window.addEventListener('verification_updated', handler as EventListener);

    // poll fallback
    const iv = setInterval(refresh, 30000);

    return () => { window.removeEventListener('verification_updated', handler as EventListener); clearInterval(iv); };
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              InternLink
            </h1>
            <p className="text-sm text-muted-foreground">Company Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-medium">{user.fullName}</p>
              <p className="text-sm text-muted-foreground">{user.companyName}</p>
            </div>
            <Button variant="outline" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Updated grid-cols-5 to accommodate the new tab */}
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="internships">My Internships</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="company">Company Profile</TabsTrigger>
            {/* New Tab Trigger for Verification */}
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Internships
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companyOverview.activeInternships}</div>
                  <p className="text-xs text-muted-foreground">
                    +2 this month
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Applications
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companyOverview.totalApplications}</div>
                  <p className="text-xs text-muted-foreground">
                    +12 this week
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Selected Candidates
                  </CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companyOverview.selected}</div>
                  <p className="text-xs text-muted-foreground">
                    14% selection rate
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pending Reviews
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{companyOverview.pending}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting review
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Application Trends
                  </CardTitle>
                  <CardDescription>
                    Applications received over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">This Week</span>
                      <span className="font-semibold">28 applications</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Last Week</span>
                      <span className="font-semibold">22 applications</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">This Month</span>
                      <span className="font-semibold">105 applications</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-success"></div>
                    <span>Selected 3 candidates for Frontend Intern role</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <span>Posted new UI/UX Design internship</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-warning"></div>
                    <span>12 new applications received</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Internships Tab */}
          <TabsContent value="internships" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">My Internships</h2>
              <Dialog open={isPostingInternship} onOpenChange={setIsPostingInternship}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setIsEditingInternship(false); setEditInternshipId(null); setPostForm({ title: '', duration: '', location: '', stipend: '', skills: '', description: '', deadline: '' }); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Post New Internship
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{isEditingInternship ? 'Edit Internship' : 'Post New Internship'}</DialogTitle>
                    <DialogDescription>
                      {isEditingInternship ? 'Update the details for this internship.' : 'Create a new internship opportunity for students.'}
                    </DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (isEditingInternship) { updateInternship(); } else { postInternship(); } }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Internship Title</Label>
                        <Input id="title" placeholder="e.g., Frontend Developer Intern" value={postForm.title} onChange={(e:any)=>setPostForm(p=>({...p,title:e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration</Label>
                        <Select value={postForm.duration} onValueChange={(v:any)=>setPostForm(p=>({...p,duration:v}))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1 Month">1 month</SelectItem>
                            <SelectItem value="2 Months">2 months</SelectItem>
                            <SelectItem value="3 Months">3 months</SelectItem>
                            <SelectItem value="6 Months">6 months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" placeholder="e.g., Mumbai, India" value={postForm.location} onChange={(e:any)=>setPostForm(p=>({...p,location:e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stipend">Stipend</Label>
                        <Input id="stipend" placeholder="e.g., ₹25,000/month" value={postForm.stipend} onChange={(e:any)=>setPostForm(p=>({...p,stipend:e.target.value}))} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="skills">Required Skills</Label>
                      <Input id="skills" placeholder="e.g., React, JavaScript, Node.js" value={postForm.skills} onChange={(e:any)=>setPostForm(p=>({...p,skills:e.target.value}))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" placeholder="Describe the internship role and responsibilities" rows={4} value={postForm.description} onChange={(e:any)=>setPostForm(p=>({...p,description:e.target.value}))} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deadline">Application Deadline</Label>
                      <Input id="deadline" type="date" value={postForm.deadline} onChange={(e:any)=>setPostForm(p=>({...p,deadline:e.target.value}))} />
                    </div>

                    <div className="flex justify-end gap-4">
                      <Button variant="outline" type="button" onClick={() => setIsPostingInternship(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {isEditingInternship ? 'Update Internship' : 'Post Internship'}
                      </Button>
                     </div>
                   </form>
                 </DialogContent>
               </Dialog>
             </div>
            
            <div className="space-y-4">
              {postedInternshipsState.map((internship) => (
                <Card key={internship.id || internship._id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{internship.title}</h3>
                          <Badge className={getStatusColor(internship.status)}>
                            {internship.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {internship.applications} applications
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {internship.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {internship.stipend}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {internship.duration}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Posted: {internship.posted}</span>
                          <span>Deadline: {internship.deadline}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => { setActiveTab('applications'); setSelectedInternshipFilter(internship.id || internship._id || internship.title); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Applications
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(internship)}>
                          Edit
                        </Button>
                       </div>
                      </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
              </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Student Applications</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Filter by Status</Button>
                <Button variant="outline" size="sm">Export List</Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {applicationsState.filter(a => !selectedInternshipFilter || a.internshipId === selectedInternshipFilter || a.internshipId === (selectedInternshipFilter) || a.internshipTitle === selectedInternshipFilter).map((application) => (
                 <Card key={application.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{application.studentName}</h3>
                          <Badge className={getStatusColor(application.status)}>
                            {application.status}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground font-medium">
                          Applied for: {application.internshipTitle}
                        </p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">University:</span>
                            <span className="ml-2">{application.university}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Course:</span>
                            <span className="ml-2">{application.course}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Year:</span>
                            <span className="ml-2">{application.year}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Applied:</span>
                            <span className="ml-2">{application.appliedDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {application.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {application.phone}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {['Pending', 'In Review'].includes(application.status) && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => updateApplicationStatus(application.id, "Selected")}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Select
                            </Button>
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => viewResume(application)}>
                          <Download className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openProfile(application)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteApplication(application.id)}>
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Company Profile Tab */}
          <TabsContent value="company" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Manage your company profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Company Name</label>
                    {isCompanyEditing ? (
                      <Input value={companyForm.companyName || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,companyName:e.target.value}))} className="mt-1" />
                    ) : (
                      <p className="mt-1 p-2 bg-muted rounded">{localUser.companyName}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Your Designation</label>
                    {isCompanyEditing ? (
                      <Input value={companyForm.designation || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,designation:e.target.value}))} className="mt-1" />
                    ) : (
                      <p className="mt-1 p-2 bg-muted rounded">{localUser.designation}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Contact Email</label>
                    {/* Email is not editable */}
                    <p className="mt-1 p-2 bg-muted rounded">{localUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">HR Representative</label>
                    {isCompanyEditing ? (
                      <Input value={companyForm.fullName || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,fullName:e.target.value}))} className="mt-1" />
                    ) : (
                      <p className="mt-1 p-2 bg-muted rounded">{localUser.fullName}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    {isCompanyEditing ? (
                      <Input value={companyForm.phone || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,phone:e.target.value}))} className="mt-1" />
                    ) : (
                      <p className="mt-1 p-2 bg-muted rounded">{localUser.phone || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">LinkedIn</label>
                    {isCompanyEditing ? (
                      <Input value={companyForm.linkedin || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,linkedin:e.target.value}))} className="mt-1" placeholder="LinkedIn profile URL" />
                    ) : (
                      <p className="mt-1 p-2 bg-muted rounded">{localUser.linkedin || '—'}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {isCompanyEditing ? (
                    <>
                      <Button variant="outline" onClick={() => { setIsCompanyEditing(false); setCompanyForm({ fullName: localUser.fullName || '', companyName: localUser.companyName || '', designation: localUser.designation || '', email: localUser.email || '', phone: localUser.phone || '', linkedin: localUser.linkedin || '' }); }}>
                        Cancel
                      </Button>
                      <Button onClick={saveCompanyProfile}>Save Changes</Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsCompanyEditing(true)}>Edit Company Profile</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* New Company Verification Tab Content */}
          <TabsContent value="verification">
             <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Company Verification</CardTitle>
                <CardDescription>
                  Verify your company to gain a trusted badge and attract more candidates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-background">
                  <p className="font-medium">Current Status:</p>
                  <Badge className={getStatusColor(verificationStatus)}>
                     <ShieldCheck className="h-4 w-4 mr-2"/>
                     {verificationStatus}
                  </Badge>
                </div>

                {verificationStatus === 'Not Verified' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Upload Verification Document</h3>
                      <p className="text-sm text-muted-foreground">
                        Please upload a document proving your company's registration, such as a Certificate of Incorporation or a business license.
                      </p>
                    </div>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label htmlFor="verification-file">Company Document (PDF, PNG, JPG)</Label>
                      <Input id="verification-file" type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                    </div>
                    <div className="max-w-sm">
                      <Label htmlFor="linkedin">LinkedIn Profile</Label>
                      <Input id="linkedin" placeholder="https://www.linkedin.com/in/your-company" value={companyForm.linkedin || ''} onChange={(e:any)=>setCompanyForm(f=>({...f,linkedin:e.target.value}))} />
                    </div>
                    <Button onClick={handleVerificationSubmit} disabled={!verificationFile && !companyForm.linkedin}>
                      Submit for Verification
                    </Button>
                  </div>
                )}

                {verificationStatus === 'Pending Review' && (
                  <div className="p-4 text-center bg-muted rounded-lg">
                    <p className="font-medium text-muted-foreground">Your documents are under review. We will notify you once the process is complete.</p>
                  </div>
                )}

                {verificationStatus === 'Verified' && (
                   <div className="p-4 text-center bg-success/10 text-black rounded-lg">
                     <p className="font-medium">Congratulations! Your company is verified.</p>
                   </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Student Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>Details submitted by the candidate</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <p className="font-semibold">{selectedApplication?.studentName || '—'}</p>
            <p className="text-sm text-muted-foreground">{selectedApplication?.email}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">University:</span>
                <div className="font-medium">{selectedApplication?.university || '—'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Course:</span>
                <div className="font-medium">{selectedApplication?.course || '—'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Year:</span>
                <div className="font-medium">{selectedApplication?.year || '—'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <div className="font-medium">{selectedApplication?.phone || '—'}</div>
              </div>
            </div>
            <div className="pt-3">
              <Button variant="outline" onClick={() => setIsProfileOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume Preview Dialog */}
      <Dialog open={resumeModalOpen} onOpenChange={setResumeModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Resume Preview</DialogTitle>
            <DialogDescription>Preview the candidate's uploaded resume.</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {resumeLoading ? (
              <p>Loading resume…</p>
            ) : resumeError ? (
              <p className="text-destructive">{resumeError}</p>
            ) : resumeUrl ? (
              <div className="h-[75vh]">
                <iframe src={resumeUrl} title="Resume" className="w-full h-full border rounded" />
              </div>
            ) : (
              <p>No resume available.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {resumeUrl && <Button onClick={() => window.open(resumeUrl, '_blank')}>Open / Download</Button>}
            <Button variant="outline" onClick={() => setResumeModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}