import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, Mail, Lock, User } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Masuk — PayFlow Premium" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Sign-up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);

  // Panel toggle
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoginSubmitting(false);
    if (error) {
      toast.error("Gagal masuk", { description: error.message });
      return;
    }
    toast.success("Berhasil masuk ke PayFlow");
    navigate({ to: "/dashboard", replace: true });
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: { data: { full_name: signupName } },
    });
    setSignupSubmitting(false);
    if (error) {
      toast.error("Gagal daftar", { description: error.message });
      return;
    }
    toast.success("Registrasi berhasil! Silakan cek email Anda untuk verifikasi.");
    setIsRightPanelActive(false);
  };

  return (
    <div className="login-page">
      {/* Decorative Background */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className={`login-container ${isRightPanelActive ? "right-panel-active" : ""}`}>
        {/* ── Sign In Form ── */}
        <div className="login-form-container login-sign-in">
          <form onSubmit={onLogin} className="login-form">
            {/* Brand */}
            <div className="login-brand">
              <div className="login-logo">
                <ShieldCheck className="login-logo-icon" />
              </div>
              <h1 className="login-title">
                Pay<span className="login-title-highlight">Flow</span>
                <Sparkles className="login-sparkle" />
              </h1>
              <p className="login-subtitle">Sistem Penggajian Karyawan Multi-Cabang</p>
            </div>

            <h2>Selamat Datang Kembali</h2>
            <p className="login-desc">Masuk menggunakan kredensial administrator Anda.</p>

            <div className="login-input-group">
              <Mail className="login-input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-input-group">
              <Lock className="login-input-icon" />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="login-btn-primary"
              disabled={loginSubmitting}
            >
              {loginSubmitting ? "Memverifikasi..." : "Masuk"}
            </Button>

            <span className="login-mobile-toggle" onClick={() => setIsRightPanelActive(true)}>
              Belum punya akun? <strong>Daftar di sini</strong>
            </span>
          </form>
        </div>

        {/* ── Sign Up Form ── */}
        <div className="login-form-container login-sign-up">
          <form onSubmit={onSignup} className="login-form">
            <h2>Buat Akun Baru</h2>
            <p className="login-desc">Isi data diri Anda untuk mendaftar.</p>

            <div className="login-input-group">
              <User className="login-input-icon" />
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                required
              />
            </div>

            <div className="login-input-group">
              <Mail className="login-input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-input-group">
              <Lock className="login-input-icon" />
              <input
                type="password"
                placeholder="Password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="login-btn-primary"
              disabled={signupSubmitting}
            >
              {signupSubmitting ? "Mendaftar..." : "Daftar Sekarang"}
            </Button>

            <span className="login-mobile-toggle" onClick={() => setIsRightPanelActive(false)}>
              Sudah punya akun? <strong>Masuk</strong>
            </span>
          </form>
        </div>

        {/* ── Overlay Panel ── */}
        <div className="login-overlay-container">
          <div className="login-overlay">
            <div className="login-overlay-panel login-overlay-left">
              <h1>Halo, Kawan!</h1>
              <p>Daftarkan diri Anda untuk mulai menggunakan PayFlow Premium.</p>
              <Button
                className="login-btn-ghost"
                onClick={() => setIsRightPanelActive(true)}
                type="button"
              >
                Daftar
              </Button>
            </div>
            <div className="login-overlay-panel login-overlay-right">
              <h1>Selamat Datang!</h1>
              <p>Sudah punya akun? Masuk dengan kredensial Anda.</p>
              <Button
                className="login-btn-ghost"
                onClick={() => setIsRightPanelActive(false)}
                type="button"
              >
                Masuk
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <span>
          © {new Date().getFullYear()} PayFlow Premium. Seluruh hak cipta dilindungi.
        </span>
      </div>
    </div>
  );
}
