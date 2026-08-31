import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, Mail, Lock, User, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Daftar — PayFlow Premium" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Password tidak cocok", {
        description: "Pastikan password dan konfirmasi password sama.",
      });
      return;
    }

    if (password.length < 6) {
      toast.error("Password terlalu pendek", {
        description: "Password minimal 6 karakter.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setSubmitting(false);

    if (error) {
      toast.error("Gagal daftar", { description: error.message });
      return;
    }

    setSuccess(true);
    toast.success("Registrasi berhasil!");
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-bg-glow login-bg-glow-1" />
        <div className="login-bg-glow login-bg-glow-2" />

        <div className="login-container" style={{ minHeight: "auto" }}>
          <div className="login-form-container" style={{ position: "relative", width: "100%" }}>
            <div className="login-form" style={{ padding: "48px 40px" }}>
              <div className="login-brand">
                <div className="login-logo" style={{ background: "linear-gradient(135deg, #10b981, #14b8a6)" }}>
                  <CheckCircle2 className="login-logo-icon" />
                </div>
                <h1 className="login-title">
                  Berhasil<span className="login-title-highlight"> Daftar</span>
                </h1>
              </div>

              <p className="login-desc" style={{ marginBottom: "24px" }}>
                Akun Anda telah berhasil dibuat. Silakan cek email <strong className="text-emerald-600">{email}</strong> untuk verifikasi, lalu masuk ke sistem.
              </p>

              <Button
                className="login-btn-primary"
                onClick={() => navigate({ to: "/login", replace: true })}
              >
                Masuk Sekarang
              </Button>
            </div>
          </div>
        </div>

        <div className="login-footer">
          <span>© {new Date().getFullYear()} PayFlow Premium. Seluruh hak cipta dilindungi.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Decorative Background */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className="login-container" style={{ minHeight: "auto" }}>
        <div className="login-form-container" style={{ position: "relative", width: "100%" }}>
          <form onSubmit={onRegister} className="login-form" style={{ padding: "40px 40px 32px" }}>
            {/* Back to Login */}
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-500 transition-colors mb-4 self-start"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Masuk
            </Link>

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

            <h2>Buat Akun Baru</h2>
            <p className="login-desc">Isi data diri Anda untuk mendaftar ke sistem.</p>

            <div className="login-input-group">
              <User className="login-input-icon" />
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="login-input-group">
              <Mail className="login-input-icon" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-input-group">
              <Lock className="login-input-icon" />
              <input
                type="password"
                placeholder="Password (min. 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div className="login-input-group">
              <Lock className="login-input-icon" />
              <input
                type="password"
                placeholder="Konfirmasi Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="login-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Mendaftar..." : "Daftar Sekarang"}
            </Button>

            <p className="login-desc" style={{ marginTop: "16px", marginBottom: 0 }}>
              Sudah punya akun?{" "}
              <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
                Masuk di sini
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <span>© {new Date().getFullYear()} PayFlow Premium. Seluruh hak cipta dilindungi.</span>
      </div>
    </div>
  );
}
