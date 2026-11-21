import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, LogIn, Trash2, Upload, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LANGUAGES, type Language } from "@/lib/scanner";

export interface SavedScan {
  id: string;
  language: string;
  code: string;
  issue_count: number;
  high_count: number;
  created_at: string;
}

export const historyKey = (uid: string) => ["scan-history", uid] as const;

export function ScanHistory({ onLoad }: { onLoad: (code: string, language: Language) => void }) {
  const { user, setAuthOpen } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: historyKey(user?.id ?? "anon"),
    enabled: !!user,
    queryFn: async (): Promise<SavedScan[]> => {
      const { data, error } = await supabase
        .from("scans")
        .select("id, language, code, issue_count, high_count, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("scans").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Scan removed from history");
    if (user) qc.invalidateQueries({ queryKey: historyKey(user.id) });
  }

  return (
    <section className="glass mt-8 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <History className="size-5 text-electric" />
        <h2 className="font-display text-lg font-bold">Your scan history</h2>
      </div>
      {!user ? (
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Log in and every scan you run gets saved here automatically.</p>
          <button onClick={() => setAuthOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition hover:glow-gold">
            <LogIn className="size-4" /> Login to save scans
          </button>
        </div>
      ) : q.isLoading ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, k) => (
            <div key={k} className="h-20 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : q.error ? (
        <p className="mt-4 text-sm text-danger">Couldn't load your history. Try refreshing the page.</p>
      ) : !q.data?.length ? (
        <p className="mt-4 text-sm text-muted-foreground">No scans yet — run your first one above and it'll appear here.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((s) => {
            const lang = LANGUAGES.find((l) => l.id === s.language);
            return (
              <li key={s.id} className="group rounded-2xl border border-border bg-surface/60 p-4 transition hover:border-electric/60">
                <div className="flex items-center gap-2 text-xs">
                  <span className="pill py-0.5 text-gold">{lang?.short ?? s.language}</span>
                  {s.issue_count === 0 ? (
                    <span className="flex items-center gap-1 text-lime">
                      <ShieldCheck className="size-3.5" /> All clear
                    </span>
                  ) : (
                    <span className={s.high_count ? "text-danger" : "text-warn"}>
                      {s.issue_count} issue{s.issue_count === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground">{new Date(s.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                <pre className="mt-2 line-clamp-2 overflow-hidden whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{s.code.slice(0, 140)}</pre>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => lang && onLoad(s.code, lang.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold transition hover:text-electric"
                  >
                    <Upload className="size-3.5" /> Load
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    aria-label="Delete scan"
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:text-danger"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
