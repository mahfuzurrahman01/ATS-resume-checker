"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Briefcase,
  Pencil,
  MoreVertical,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/score-badge";
import type { ResumeCard } from "@/lib/db/resumes";

type SortMode = "recent" | "score";

interface ResumesListClientProps {
  resumes: ResumeCard[];
  hasCredits: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
};

export function ResumesListClient({
  resumes,
  hasCredits,
}: ResumesListClientProps) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = resumes;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.display_name || r.file_name).toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortMode === "score") {
        const as = a.latestScore ?? -1;
        const bs = b.latestScore ?? -1;
        if (as !== bs) return bs - as;
      }
      return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
    });
  }, [resumes, search, sortMode]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startRename = (resume: ResumeCard) => {
    setOpenMenuId(null);
    setRenamingId(resume.id);
    setRenameValue(resume.display_name || resume.file_name);
    setError(null);
  };

  const saveRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    setSavingRename(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to rename.");
        setSavingRename(false);
        return;
      }
      setRenamingId(null);
      setSavingRename(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSavingRename(false);
    }
  };

  const confirmDelete = async (id: string) => {
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete.");
        setDeleteBusy(false);
        return;
      }
      setDeletingId(null);
      setDeleteBusy(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort:</span>
          <button
            onClick={() => setSortMode("recent")}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              sortMode === "recent"
                ? "bg-purple-600 text-white"
                : "bg-gray-900/50 text-gray-300 border border-gray-700/40"
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setSortMode("score")}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              sortMode === "score"
                ? "bg-purple-600 text-white"
                : "bg-gray-900/50 text-gray-300 border border-gray-700/40"
            }`}
          >
            Highest score
          </button>
        </div>

        {resumes.length > 8 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resumes…"
              className="pl-9 pr-3 py-1.5 rounded-full bg-gray-900/50 border border-gray-700/40 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
        )}

        {hasCredits ? (
          <Link href="/scan">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New scan
            </Button>
          </Link>
        ) : (
          <Link href="/pricing">
            <Button className="bg-gray-800 text-gray-200 border border-gray-700/40">
              Out of credits — get more
            </Button>
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {visible.length === 0 ? (
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-300 mb-4">
              {search
                ? "No resumes match your search."
                : "You haven't scanned a resume yet."}
            </p>
            {!search && (
              <Link href="/scan">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                  Scan your first resume
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((resume) => (
            <Card
              key={resume.id}
              className="bg-gray-900/20 border border-gray-700/30"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {renamingId === resume.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename(resume.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            disabled={savingRename}
                            className="min-w-0 flex-1 rounded-lg bg-gray-800 border border-purple-500/50 px-2 py-1 text-sm text-white focus:outline-none"
                          />
                          <button
                            onClick={() => saveRename(resume.id)}
                            disabled={savingRename}
                            className="text-green-400 hover:text-green-300"
                            aria-label="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="text-gray-400 hover:text-gray-300"
                            aria-label="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Link
                          href={`/resumes/${resume.id}`}
                          className="group flex items-center gap-2 min-w-0"
                        >
                          <p className="text-sm font-medium text-white truncate">
                            {resume.display_name || resume.file_name}
                          </p>
                          <Pencil
                            onClick={(e) => {
                              e.preventDefault();
                              startRename(resume);
                            }}
                            className="h-3.5 w-3.5 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          />
                        </Link>
                      )}
                      {resume.display_name && (
                        <p className="text-xs text-gray-500 truncate">
                          {resume.file_name}
                        </p>
                      )}
                      {resume.topIssue && (
                        <p
                          className={`text-xs mt-0.5 ${
                            SEVERITY_COLOR[resume.topIssue.severity]
                          }`}
                        >
                          {resume.topIssue.title}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(resume.lastActivityAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <ScoreBadge score={resume.latestScore} />

                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === resume.id ? null : resume.id
                          )
                        }
                        className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60"
                        aria-label="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === resume.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 mt-1 w-44 rounded-xl bg-gray-900 border border-gray-700/50 shadow-2xl z-20 overflow-hidden">
                            <button
                              onClick={() => startRename(resume)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 text-left"
                            >
                              <Pencil className="h-4 w-4" />
                              Rename
                            </button>
                            <a
                              href={`/api/resumes/${resume.id}/file?download=1`}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </a>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeletingId(resume.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 text-left"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {resume.matches.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <button
                      onClick={() => toggleExpanded(resume.id)}
                      className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      {resume.matches.length} job match
                      {resume.matches.length === 1 ? "" : "es"}
                      {expandedIds.has(resume.id) ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {expandedIds.has(resume.id) && (
                      <div className="mt-2 space-y-1">
                        {resume.matches.map((m) => (
                          <Link
                            key={m.id}
                            href={`/resumes/${resume.id}/matches/${m.id}`}
                            className="flex items-center justify-between rounded-lg bg-gray-800/40 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800/70"
                          >
                            <span>{m.jobTitle || "Job match"}</span>
                            <span className="text-blue-300 font-medium">
                              {m.matchScore}%
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <Card className="bg-gray-900 border border-gray-700/50 max-w-sm w-full">
            <CardContent className="p-6 space-y-4">
              <p className="text-white font-medium">Delete this resume?</p>
              <p className="text-sm text-gray-400">
                This permanently deletes the file and all its scans and job
                matches. This can&apos;t be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={deleteBusy}
                  onClick={() => setDeletingId(null)}
                  className="bg-gray-800 border-gray-700/50 text-gray-200"
                >
                  Cancel
                </Button>
                <Button
                  disabled={deleteBusy}
                  onClick={() => confirmDelete(deletingId)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
