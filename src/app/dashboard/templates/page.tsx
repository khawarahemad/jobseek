"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Save, CheckCircle2, AlertCircle, Sparkles, Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category?: string | null;
  subject: string;
  body: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.templates && data.templates.length > 0) {
        setTemplates(data.templates);
        selectTemplate(data.templates[0]);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectTemplate = (tmpl: Template) => {
    setSelectedId(tmpl.id);
    setName(tmpl.name);
    setCategory(tmpl.category || "General");
    setSubject(tmpl.subject);
    setBody(tmpl.body);
    setStatusMsg(null);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId,
          name,
          category,
          subject,
          emailBody: body,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");

      setTemplates(templates.map((t) => (t.id === selectedId ? data.template : t)));
      setStatusMsg({ type: "success", text: "Template saved successfully!" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Custom Sequence",
          category: "Engineering",
          subject: "Engineering Role – {{candidate_name}} ({{company}})",
          emailBody:
            "Hi {{hr_name}},\n\nReaching out because I've been following {{company_context}} and wanted to explore opportunities at {{company}}.\n\nBest,\n{{candidate_name}}",
        }),
      });

      const data = await res.json();
      if (res.ok && data.template) {
        setTemplates([data.template, ...templates]);
        selectTemplate(data.template);
      }
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + " " + variable);
  };

  const variables = [
    { label: "Company", tag: "{{company}}" },
    { label: "AI Context", tag: "{{company_context}}" },
    { label: "Recruiter", tag: "{{hr_name}}" },
    { label: "Your Name", tag: "{{candidate_name}}" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-zinc-100">
      {/* Sleek, Compact Header */}
      <header className="flex items-center justify-between border-b border-zinc-800/70 bg-[#09090b]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 shrink-0">
        <div>
          <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight">Email Templates</h1>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Build sequencing templates with autonomous AI personalization variables.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 text-[11px] font-semibold text-white transition-all shadow-sm"
        >
          <Plus className="h-3 w-3" /> New Template
        </button>
      </header>

      {/* Main Container - Lite & High Density */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar List - Slim */}
        <div className="w-56 sm:w-64 border-r border-zinc-800/80 bg-[#0c0c0f]/60 p-2.5 flex flex-col gap-1.5 overflow-y-auto shrink-0">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1.5 mb-0.5">
            Sequences ({templates.length})
          </span>

          {isLoading ? (
            <div className="p-6 text-center text-xs text-zinc-500">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-xs text-zinc-500 text-center">
              No templates yet. Click &quot;New Template&quot; to begin.
            </div>
          ) : (
            templates.map((tmpl) => {
              const isSelected = tmpl.id === selectedId;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => selectTemplate(tmpl)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg p-2 text-left transition-all border ${
                    isSelected
                      ? "border-indigo-500/50 bg-indigo-500/10 shadow-sm"
                      : "border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-800/40"
                  }`}
                >
                  <span
                    className={`font-semibold text-xs truncate w-full ${
                      isSelected ? "text-white" : "text-zinc-300"
                    }`}
                  >
                    {tmpl.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {tmpl.category || "General"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Right Editor Area - Compact */}
        <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto">
          {selectedId ? (
            <div className="mx-auto w-full max-w-2xl flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center text-indigo-400 border border-zinc-700/50 shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex h-7 items-center gap-1.5 rounded-lg bg-zinc-100 hover:bg-white px-3 text-[11px] font-semibold text-black transition-all shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save Changes
                </button>
              </div>

              {statusMsg && (
                <div
                  className={`flex items-center gap-1.5 rounded-lg p-2 text-[11px] ${
                    statusMsg.type === "success"
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                      : "bg-red-500/10 text-red-300 border border-red-500/30"
                  }`}
                >
                  {statusMsg.type === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {statusMsg.text}
                </div>
              )}

              {/* Variable Chips - Compact */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-2.5">
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Insert Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariable(v.tag)}
                      className="rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-mono text-indigo-300 transition-colors flex items-center gap-1"
                    >
                      <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                      {v.label} <span className="text-zinc-500">{v.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Subject Line Template
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-8 rounded-lg border border-zinc-800 bg-[#101014] px-3 text-xs text-white focus:border-zinc-600 focus:outline-none"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col flex-1 min-h-[300px]">
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Email Body Template
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-800 bg-[#101014] p-3 text-xs text-zinc-200 font-mono leading-relaxed focus:border-zinc-600 focus:outline-none resize-none min-h-[260px]"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
              Select or create a template to begin editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
