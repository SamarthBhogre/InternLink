import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "./auth/LoginForm";
import { SignupForm } from "./auth/SignupForm";
import { toast } from "@/hooks/use-toast";

interface User {
  userType: string;
  email: string;
  fullName: string;
  [key: string]: any;
}

export function InternLinkApp() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const handleLogin = (email: string, password: string, userType: string, userFromServer?: any) => {
    // If backend returned a user object prefer that, otherwise fall back to a mock
    const resolvedUser: User = userFromServer
      ? { userType: userFromServer.userType || userType, email: userFromServer.email || email, fullName: userFromServer.fullName || getUserName(userType), ...userFromServer }
      : {
          userType,
          email,
          fullName: getUserName(userType),
          ...(userType === "student" && {
            university: "IIT Delhi",
            course: "Computer Science",
            yearOfStudy: "3rd Year"
          }),
          ...(userType === "company" && {
            companyName: "TechCorp Solutions",
            designation: "HR Manager"
          })
        };

    setCurrentUser(resolvedUser);
    // persist user so routes can read it
    try { localStorage.setItem('internlink_user', JSON.stringify(resolvedUser)); } catch (e) {}
    toast({
      title: "Login Successful",
      description: `Welcome back, ${resolvedUser.fullName}!`,
    });
    // navigate to selected dashboard
    const target = resolvedUser.userType || userType;
    switch (target) {
      case 'student':
        navigate('/student-dashboard');
        break;
      case 'company':
        navigate('/company-dashboard');
        break;
      case 'admin':
        navigate('/admin-dashboard');
        break;
      default:
        navigate('/');
    }
  };

  const handleSignup = (userData: any) => {
    // Use backend response when available (userData may be data.user)
    const createdUser: User = {
      userType: userData.userType || 'student',
      email: userData.email,
      fullName: userData.fullName || userData.companyName || getUserName(userData.userType),
      ...userData
    };
    setCurrentUser(createdUser);
    try { localStorage.setItem('internlink_user', JSON.stringify(createdUser)); } catch (e) {}
    toast({
      title: "Account Created",
      description: `Welcome to InternLink, ${createdUser.fullName}!`,
    });
    // If company, navigate to company dashboard
    if (createdUser.userType === 'company') {
      navigate('/company-dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
  };

  function getUserName(userType: string) {
    switch (userType) {
      case "student": return "Rahul Sharma";
      case "company": return "Priya Patel";
      case "admin": return "System Administrator";
      default: return "User";
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
  };

  // Do not render dashboards here; after login we navigate to dashboard routes

  // Show authentication forms
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLoginMode ? (
          <LoginForm onToggleMode={toggleMode} onLogin={handleLogin} />
        ) : (
          <SignupForm onToggleMode={toggleMode} onSignup={handleSignup} />
        )}
      </div>
    </div>
  );
}