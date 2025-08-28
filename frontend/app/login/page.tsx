"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    r.push("/home");
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-2xl font-semibold mb-2">Вход</h1>
      <p className="text-neutral-400 mb-4">Введи email и пароль.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-lg bg-neutral-900/60 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          type="email" placeholder="email@example.com"
          value={email} onChange={e=>setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg bg-neutral-900/60 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
          type="password" placeholder="Пароль"
          value={pw} onChange={e=>setPw(e.target.value)}
        />
        <button className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
      {err && <div className="text-red-400 mt-3">{err}</div>}
    </div>
  );
}
