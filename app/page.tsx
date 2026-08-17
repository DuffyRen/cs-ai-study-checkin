"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage is restored after hydration. */

import type { User } from "@supabase/supabase-js";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { supabase, type StudyDayRow } from "./cloudSync";
import { studyDays } from "./studyData";

const STORAGE_KEY = "cs-ai-study-checkin-v1";
const DETAILS_STORAGE_KEY = "cs-ai-study-details-v1";
const FOCUS_SECONDS = 25 * 60;

type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

const phaseNotes: Record<string, string> = {
  "Python 基础": "先把代码写起来",
  "数据结构与算法": "理解程序背后的结构",
  "Python 项目": "做出能重复使用的工具",
  机器学习: "体验数据到预测的完整流程",
  "LLM 与 Agent": "把模型、工具与行动连接起来",
};

type ViewKey = "today" | "plan" | "notes" | "progress";

const views: Array<{ id: ViewKey; label: string; hint: string }> = [
  { id: "today", label: "今天", hint: "现在做什么" },
  { id: "plan", label: "计划", hint: "按周查看" },
  { id: "notes", label: "笔记", hint: "集中回顾" },
  { id: "progress", label: "进度", hint: "84 天轨迹" },
];

function ArrowIcon() {
  return <span aria-hidden="true" className="arrow-icon">↗</span>;
}

function CheckIcon() {
  return <span aria-hidden="true" className="check-icon">✓</span>;
}

function phaseClass(phase: string) {
  return `phase-${phase.replaceAll(" ", "-")}`;
}

function cleanNotes(value: unknown): Record<number, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([day, note]) => {
      const dayNumber = Number(day);
      return dayNumber >= 1 && dayNumber <= studyDays.length && typeof note === "string";
    }),
  );
}

function cleanMinutes(value: unknown): Record<number, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([day, minutes]) => {
      const dayNumber = Number(day);
      return (
        dayNumber >= 1 &&
        dayNumber <= studyDays.length &&
        typeof minutes === "number" &&
        Number.isFinite(minutes) &&
        minutes >= 0
      );
    }),
  );
}

function cleanModifiedAt(value: unknown): Record<number, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([day, timestamp]) => {
      const dayNumber = Number(day);
      return (
        dayNumber >= 1 &&
        dayNumber <= studyDays.length &&
        typeof timestamp === "string" &&
        !Number.isNaN(Date.parse(timestamp))
      );
    }),
  );
}

function formatSyncTime(timestamp: Date | null) {
  if (!timestamp) return "等待首次同步";
  return `${String(timestamp.getHours()).padStart(2, "0")}:${String(timestamp.getMinutes()).padStart(2, "0")} 已同步`;
}

export default function Home() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("today");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [focusMinutes, setFocusMinutes] = useState<Record<number, number>>({});
  const [modifiedAt, setModifiedAt] = useState<Record<number, string>>({});
  const [timerSeconds, setTimerSeconds] = useState(FOCUS_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [noteQuery, setNoteQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncInitialized, setSyncInitialized] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncRetry, setSyncRetry] = useState(0);
  const lastSyncedRef = useRef<Record<number, string>>({});
  const stateRef = useRef({ completed, notes, focusMinutes, modifiedAt });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      let savedDays = new Set<number>();
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          savedDays = new Set<number>(
            parsed.filter(
              (day): day is number =>
                Number.isInteger(day) && day >= 1 && day <= studyDays.length,
            ),
          );
          setCompleted(savedDays);
          const next = studyDays.find((item) => !savedDays.has(item.day));
          if (next) setSelectedWeek(next.week);
        }
      }

      const savedDetails = window.localStorage.getItem(DETAILS_STORAGE_KEY);
      let savedNotes: Record<number, string> = {};
      let savedMinutes: Record<number, number> = {};
      let savedModifiedAt: Record<number, string> = {};
      if (savedDetails) {
        const parsedDetails = JSON.parse(savedDetails);
        if (parsedDetails && typeof parsedDetails === "object") {
          savedNotes = cleanNotes(parsedDetails.notes);
          savedMinutes = cleanMinutes(parsedDetails.focusMinutes);
          savedModifiedAt = cleanModifiedAt(parsedDetails.modifiedAt);
        }
      }

      const migrationTime = new Date().toISOString();
      for (const item of studyDays) {
        if (
          !savedModifiedAt[item.day] &&
          (savedDays.has(item.day) || savedNotes[item.day] || (savedMinutes[item.day] ?? 0) > 0)
        ) {
          savedModifiedAt[item.day] = migrationTime;
        }
      }
      setNotes(savedNotes);
      setFocusMinutes(savedMinutes);
      setModifiedAt(savedModifiedAt);
    } catch {
      // A private browser session can block storage; check-ins still work in-session.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(completed).sort((a, b) => a - b)),
      );
    } catch {
      // Keep the interaction usable even if local storage is unavailable.
    }
  }, [completed, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        DETAILS_STORAGE_KEY,
        JSON.stringify({ notes, focusMinutes, modifiedAt }),
      );
    } catch {
      // Keep notes and timer usable in-session when storage is unavailable.
    }
  }, [focusMinutes, modifiedAt, notes, ready]);

  useEffect(() => {
    stateRef.current = { completed, notes, focusMinutes, modifiedAt };
  }, [completed, focusMinutes, modifiedAt, notes]);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setAuthMessage("");
      if (!session) {
        setSyncInitialized(false);
        setSyncStatus("local");
        setLastSyncAt(null);
        lastSyncedRef.current = {};
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setSyncRetry((current) => current + 1);
    const handleOffline = () => user && setSyncStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;

    async function initializeCloudSync() {
      setSyncInitialized(false);
      setSyncStatus(navigator.onLine ? "syncing" : "offline");
      if (!navigator.onLine) return;

      const { data, error } = await supabase
        .from("study_day_states")
        .select("user_id, day_number, completed, note, focus_minutes, updated_at")
        .eq("user_id", user!.id);

      if (cancelled) return;
      if (error) {
        setSyncStatus("error");
        return;
      }

      const snapshot = stateRef.current;
      const nextCompleted = new Set(snapshot.completed);
      const nextNotes = { ...snapshot.notes };
      const nextFocusMinutes = { ...snapshot.focusMinutes };
      const nextModifiedAt = { ...snapshot.modifiedAt };
      const cloudRows = new Map(
        ((data ?? []) as StudyDayRow[]).map((row) => [row.day_number, row]),
      );
      const rowsToUpload: StudyDayRow[] = [];

      for (const item of studyDays) {
        const day = item.day;
        const cloud = cloudRows.get(day);
        const localTimestamp = nextModifiedAt[day];
        const hasLocalDay =
          nextCompleted.has(day) ||
          Boolean(nextNotes[day]) ||
          (nextFocusMinutes[day] ?? 0) > 0;

        if (!cloud) {
          if (localTimestamp || hasLocalDay) {
            const timestamp = localTimestamp ?? new Date().toISOString();
            nextModifiedAt[day] = timestamp;
            rowsToUpload.push({
              user_id: user!.id,
              day_number: day,
              completed: nextCompleted.has(day),
              note: nextNotes[day] ?? "",
              focus_minutes: nextFocusMinutes[day] ?? 0,
              updated_at: timestamp,
            });
          }
          continue;
        }

        if (localTimestamp && Date.parse(localTimestamp) > Date.parse(cloud.updated_at)) {
          rowsToUpload.push({
            user_id: user!.id,
            day_number: day,
            completed: nextCompleted.has(day),
            note: nextNotes[day] ?? "",
            focus_minutes: nextFocusMinutes[day] ?? 0,
            updated_at: localTimestamp,
          });
          continue;
        }

        if (cloud.completed) nextCompleted.add(day);
        else nextCompleted.delete(day);
        if (cloud.note) nextNotes[day] = cloud.note;
        else delete nextNotes[day];
        if (cloud.focus_minutes > 0) nextFocusMinutes[day] = cloud.focus_minutes;
        else delete nextFocusMinutes[day];
        nextModifiedAt[day] = cloud.updated_at;
        lastSyncedRef.current[day] = cloud.updated_at;
      }

      stateRef.current = {
        completed: nextCompleted,
        notes: nextNotes,
        focusMinutes: nextFocusMinutes,
        modifiedAt: nextModifiedAt,
      };
      setCompleted(nextCompleted);
      setNotes(nextNotes);
      setFocusMinutes(nextFocusMinutes);
      setModifiedAt(nextModifiedAt);

      if (rowsToUpload.length > 0) {
        const { error: uploadError } = await supabase
          .from("study_day_states")
          .upsert(rowsToUpload, { onConflict: "user_id,day_number" });
        if (cancelled) return;
        if (uploadError) {
          setSyncStatus("error");
          return;
        }
        for (const row of rowsToUpload) {
          lastSyncedRef.current[row.day_number] = row.updated_at;
        }
      }

      setSyncInitialized(true);
      setSyncStatus("synced");
      setLastSyncAt(new Date());
    }

    void initializeCloudSync();
    return () => {
      cancelled = true;
    };
  }, [ready, syncRetry, user]);

  useEffect(() => {
    if (!ready || !user) return;

    const channel = supabase
      .channel(`study-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_day_states",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as StudyDayRow;
          if (!row?.day_number || row.day_number < 1 || row.day_number > studyDays.length) return;

          const localTimestamp = stateRef.current.modifiedAt[row.day_number];
          if (localTimestamp && Date.parse(localTimestamp) > Date.parse(row.updated_at)) return;

          const nextCompleted = new Set(stateRef.current.completed);
          const nextNotes = { ...stateRef.current.notes };
          const nextFocusMinutes = { ...stateRef.current.focusMinutes };
          const nextModifiedAt = { ...stateRef.current.modifiedAt, [row.day_number]: row.updated_at };

          if (row.completed) nextCompleted.add(row.day_number);
          else nextCompleted.delete(row.day_number);
          if (row.note) nextNotes[row.day_number] = row.note;
          else delete nextNotes[row.day_number];
          if (row.focus_minutes > 0) nextFocusMinutes[row.day_number] = row.focus_minutes;
          else delete nextFocusMinutes[row.day_number];

          stateRef.current = {
            completed: nextCompleted,
            notes: nextNotes,
            focusMinutes: nextFocusMinutes,
            modifiedAt: nextModifiedAt,
          };
          lastSyncedRef.current[row.day_number] = row.updated_at;
          setCompleted(nextCompleted);
          setNotes(nextNotes);
          setFocusMinutes(nextFocusMinutes);
          setModifiedAt(nextModifiedAt);
          setSyncStatus("synced");
          setLastSyncAt(new Date());
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user || !syncInitialized) return;

    const dirtyDays = Object.entries(modifiedAt)
      .map(([day, timestamp]) => ({ day: Number(day), timestamp }))
      .filter(({ day, timestamp }) => timestamp > (lastSyncedRef.current[day] ?? ""));
    if (dirtyDays.length === 0) return;

    if (!navigator.onLine) {
      setSyncStatus("offline");
      return;
    }

    setSyncStatus("syncing");
    const timeout = window.setTimeout(async () => {
      const snapshot = stateRef.current;
      const rows = dirtyDays
        .filter(({ day, timestamp }) => snapshot.modifiedAt[day] === timestamp)
        .map(({ day, timestamp }) => ({
          user_id: user.id,
          day_number: day,
          completed: snapshot.completed.has(day),
          note: snapshot.notes[day] ?? "",
          focus_minutes: snapshot.focusMinutes[day] ?? 0,
          updated_at: timestamp,
        }));
      if (rows.length === 0) return;

      const { error } = await supabase
        .from("study_day_states")
        .upsert(rows, { onConflict: "user_id,day_number" });
      if (error) {
        setSyncStatus(navigator.onLine ? "error" : "offline");
        return;
      }

      for (const row of rows) lastSyncedRef.current[row.day_number] = row.updated_at;
      setSyncStatus("synced");
      setLastSyncAt(new Date());
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [completed, focusMinutes, modifiedAt, notes, ready, syncInitialized, user]);

  const nextDay = useMemo(
    () => studyDays.find((item) => !completed.has(item.day)) ?? studyDays.at(-1)!,
    [completed],
  );

  const todayLabel = `${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`;
  const scheduledToday = studyDays.find((item) => item.date === todayLabel);
  const focusDay = scheduledToday && !completed.has(scheduledToday.day) ? scheduledToday : nextDay;
  const percentage = Math.round((completed.size / studyDays.length) * 100);
  const completedSequence = useMemo(() => {
    let count = 0;
    for (const item of studyDays) {
      if (!completed.has(item.day)) break;
      count += 1;
    }
    return count;
  }, [completed]);
  const totalFocusMinutes = useMemo(
    () => Object.values(focusMinutes).reduce((sum, minutes) => sum + minutes, 0),
    [focusMinutes],
  );
  const hasLocalData =
    completed.size > 0 ||
    totalFocusMinutes > 0 ||
    Object.values(notes).some((note) => note.trim().length > 0);
  const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;
  const notedDays = useMemo(() => {
    const query = noteQuery.trim().toLocaleLowerCase("zh-CN");
    return studyDays.filter((item) => {
      const note = notes[item.day]?.trim();
      if (!note) return false;
      if (!query) return true;
      return [note, item.course, item.phase, item.task, item.date]
        .join(" ")
        .toLocaleLowerCase("zh-CN")
        .includes(query);
    });
  }, [noteQuery, notes]);
  const noteCount = Object.values(notes).filter((note) => note.trim().length > 0).length;
  const noteCharacters = Object.values(notes).reduce((sum, note) => sum + note.trim().length, 0);

  const weeks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        week: index + 1,
        days: studyDays.filter((item) => item.week === index + 1),
      })),
    [],
  );

  const focusWeek = weeks[focusDay.week - 1];
  const selectedWeekData = weeks[selectedWeek - 1];
  const focusWeekDone = focusWeek.days.filter((item) => completed.has(item.day)).length;

  const phaseProgress = useMemo(
    () =>
      Object.keys(phaseNotes).map((phase) => {
        const days = studyDays.filter((item) => item.phase === phase);
        return {
          phase,
          total: days.length,
          done: days.filter((item) => completed.has(item.day)).length,
        };
      }),
    [completed],
  );

  useEffect(() => {
    setTimerRunning(false);
    setTimerSeconds(FOCUS_SECONDS);
  }, [focusDay.day]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setTimerSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setTimerRunning(false);
          setFocusMinutes((minutes) => ({
            ...minutes,
            [focusDay.day]: (minutes[focusDay.day] ?? 0) + 25,
          }));
          markDayModified(focusDay.day);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusDay.day, timerRunning]);

  function markDayModified(day: number) {
    setModifiedAt((current) => ({ ...current, [day]: new Date().toISOString() }));
  }

  function markAllDaysModified() {
    const timestamp = new Date().toISOString();
    setModifiedAt(
      Object.fromEntries(studyDays.map((item) => [item.day, timestamp])),
    );
  }

  function toggleDay(day: number) {
    setCompleted((current) => {
      const updated = new Set(current);
      if (updated.has(day)) updated.delete(day);
      else updated.add(day);
      return updated;
    });
    markDayModified(day);
  }

  function changeView(view: ViewKey) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDay(day: number) {
    const item = studyDays[day - 1];
    setSelectedWeek(item.week);
    setActiveView("plan");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateNote(day: number, note: string) {
    setNotes((current) => ({ ...current, [day]: note.slice(0, 500) }));
    markDayModified(day);
  }

  function resetTimer() {
    setTimerRunning(false);
    setTimerSeconds(FOCUS_SECONDS);
  }

  function exportBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      completed: Array.from(completed).sort((a, b) => a - b),
      notes,
      focusMinutes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cs-ai-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("导入会替换当前浏览器里的打卡、笔记和专注时长，继续吗？")) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.completed)) {
        throw new Error("invalid backup");
      }
      setCompleted(
        new Set(
          parsed.completed.filter(
            (day: unknown): day is number =>
              Number.isInteger(day) && Number(day) >= 1 && Number(day) <= studyDays.length,
          ),
        ),
      );
      setNotes(cleanNotes(parsed.notes));
      setFocusMinutes(cleanMinutes(parsed.focusMinutes));
      markAllDaysModified();
      window.alert("学习记录已恢复。");
    } catch {
      window.alert("无法导入：请选择由本网页导出的 JSON 备份文件。");
    }
  }

  function resetProgress() {
    const scope = user ? "所有已登录设备" : "这台设备";
    if (window.confirm(`确定清除${scope}上的打卡、笔记和专注时长吗？`)) {
      setCompleted(new Set());
      setNotes({});
      setFocusMinutes({});
      markAllDaysModified();
      resetTimer();
      setSelectedWeek(1);
      setActiveView("today");
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = authEmail.trim();
    if (!email) return;

    setAuthPending(true);
    setAuthMessage("");
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setAuthPending(false);
    setAuthMessage(
      error
        ? `登录链接发送失败：${error.message}`
        : "登录链接已发送。请在这台设备打开邮件中的链接。",
    );
  }

  async function signOut() {
    setAuthPending(true);
    const { error } = await supabase.auth.signOut();
    setAuthPending(false);
    if (error) setAuthMessage(`退出失败：${error.message}`);
    else setSyncPanelOpen(false);
  }

  const syncLabel = !user
    ? "仅本机"
    : syncStatus === "syncing"
      ? "正在同步"
      : syncStatus === "offline"
        ? "离线保存"
        : syncStatus === "error"
          ? "同步异常"
          : "云端已同步";
  const syncDetail = !user
    ? "登录后跨设备"
    : syncStatus === "offline"
      ? "联网后自动继续"
      : syncStatus === "error"
        ? "点击重试"
        : formatSyncTime(lastSyncAt);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">84</span>
          <div>
            <p>CS / AI 学习计划</p>
            <span>8.17 — 11.08 · 每天 60–90 分钟</span>
          </div>
        </div>

        <div className="view-tabs" role="tablist" aria-label="学习打卡视图">
          {views.map((view) => (
            <button
              key={view.id}
              id={`tab-${view.id}`}
              role="tab"
              aria-selected={activeView === view.id}
              aria-controls={`panel-${view.id}`}
              className={activeView === view.id ? "active" : ""}
              onClick={() => changeView(view.id)}
            >
              <b>{view.label}</b>
              <span>{view.hint}</span>
            </button>
          ))}
        </div>

        <div className="header-actions">
          <button
            className={`sync-status-button status-${syncStatus}`}
            onClick={() => setSyncPanelOpen(true)}
            aria-label={`同步状态：${syncLabel}`}
          >
            <span className="sync-orbit" aria-hidden="true"><i /><i /></span>
            <span><b>{syncLabel}</b><em>{syncDetail}</em></span>
          </button>
          <button className="header-progress" onClick={() => changeView("progress")}>
            <span>{completed.size} / 84</span>
            <i><b style={{ width: `${percentage}%` }} /></i>
          </button>
        </div>
      </header>

      {syncPanelOpen && (
        <div className="sync-modal-backdrop">
          <section className="sync-modal" role="dialog" aria-modal="true" aria-labelledby="sync-modal-title">
            <button
              className="sync-modal-close"
              onClick={() => setSyncPanelOpen(false)}
              aria-label="关闭同步设置"
            >
              ×
            </button>
            <p className="overline">CLOUD SYNC</p>
            <h2 id="sync-modal-title">让学习记录跟着你。</h2>
            <p className="sync-modal-lead">
              {user
                ? "打卡、笔记和专注时长会自动同步；断网时照常记录，联网后继续。"
                : "使用邮箱登录后，这台设备上的现有记录会与云端合并，不会被清空。"}
            </p>

            {user ? (
              <>
                <div className={`sync-account-card status-${syncStatus}`}>
                  <span className="sync-account-mark" aria-hidden="true"><i /><i /></span>
                  <div>
                    <b>{syncLabel}</b>
                    <span>{user.email ?? "已登录账号"}</span>
                  </div>
                  <em>{syncDetail}</em>
                </div>
                <ul className="sync-facts">
                  <li><b>自动保存</b><span>修改后约 1 秒写入云端</span></li>
                  <li><b>逐日合并</b><span>不同日期的记录不会互相覆盖</span></li>
                  <li><b>仅你可见</b><span>数据库按登录账号隔离</span></li>
                </ul>
                {authMessage && <p className="sync-message" role="status">{authMessage}</p>}
                <div className="sync-modal-actions">
                  <button
                    onClick={() => setSyncRetry((current) => current + 1)}
                    disabled={syncStatus === "syncing"}
                  >
                    {syncStatus === "syncing" ? "正在同步" : "立即同步"}
                  </button>
                  <button className="quiet" onClick={signOut} disabled={authPending}>退出登录</button>
                </div>
              </>
            ) : (
              <form className="sync-login-form" onSubmit={sendMagicLink}>
                <label htmlFor="sync-email">邮箱</label>
                <input
                  id="sync-email"
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
                <button type="submit" disabled={authPending}>
                  {authPending ? "正在发送" : "发送登录链接"}
                </button>
                <p>请使用你刚才登录 Supabase 的同一邮箱；无需设置密码，其他设备也使用这一个邮箱。</p>
                {authMessage && <p className="sync-message" role="status">{authMessage}</p>}
              </form>
            )}
          </section>
        </div>
      )}

      {activeView === "today" && (
        <section
          className="view-panel today-view"
          id="panel-today"
          role="tabpanel"
          aria-labelledby="tab-today"
        >
          <div className="view-intro">
            <div>
              <p className="overline">YOUR NEXT STEP</p>
              <h1>今天只完成这一件事。</h1>
            </div>
            <p>打开课程，完成任务，回来打勾。其他内容先不用管。</p>
          </div>

          <div className="today-workspace">
            <article className="focus-card">
              <div className="focus-card-top">
                <span className="day-code">DAY {String(focusDay.day).padStart(2, "0")}</span>
                <time>{focusDay.date}</time>
              </div>
              <div className="focus-card-body">
                <span className={`phase-badge ${phaseClass(focusDay.phase)}`}>
                  {focusDay.phase}
                </span>
                <h2>{focusDay.course}</h2>
                <p>{focusDay.task}</p>
              </div>
              <div className="focus-card-actions">
                <a className="course-button" href={focusDay.url} target="_blank" rel="noreferrer">
                  打开课程 <ArrowIcon />
                </a>
                <label className={`completion-control ${completed.has(focusDay.day) ? "is-done" : ""}`}>
                  <input
                    type="checkbox"
                    checked={completed.has(focusDay.day)}
                    onChange={() => toggleDay(focusDay.day)}
                  />
                  <span className="compact-check-box" aria-hidden="true"><CheckIcon /></span>
                  <span className="completion-copy">
                    <b>{completed.has(focusDay.day) ? "今天已完成" : "完成今日任务"}</b>
                    <em>本周进度 {focusWeekDone} / 7</em>
                  </span>
                </label>
              </div>
            </article>
          </div>

          <section className="study-tools" aria-label="今日学习工具">
            <article className="timer-tool">
              <div>
                <p className="overline">FOCUS TIMER</p>
                <h2>专注 25 分钟</h2>
                <span>本日累计 {focusMinutes[focusDay.day] ?? 0} 分钟</span>
              </div>
              <strong aria-live="polite">{timerLabel}</strong>
              <div className="timer-actions">
                <button
                  onClick={() => {
                    if (timerSeconds === 0) {
                      setTimerSeconds(FOCUS_SECONDS);
                      setTimerRunning(true);
                    } else {
                      setTimerRunning((running) => !running);
                    }
                  }}
                >
                  {timerRunning ? "暂停" : timerSeconds === 0 ? "再来一次" : "开始"}
                </button>
                <button className="quiet" onClick={resetTimer}>重置</button>
              </div>
            </article>

            <div className="note-tool">
              <label htmlFor={`today-note-${focusDay.day}`}>
                <b>今天记住了什么？</b>
                <em>{(notes[focusDay.day] ?? "").length}/500</em>
              </label>
              <textarea
                id={`today-note-${focusDay.day}`}
                value={notes[focusDay.day] ?? ""}
                onChange={(event) => updateNote(focusDay.day, event.target.value)}
                placeholder="记一句关键理解、一个问题，或下一步要验证的想法……"
                maxLength={500}
              />
            </div>
          </section>

          <section className="this-week" aria-labelledby="this-week-title">
            <div className="subsection-heading">
              <div>
                <p className="overline">WEEK {String(focusDay.week).padStart(2, "0")}</p>
                <h2 id="this-week-title">这周的 7 个小任务</h2>
              </div>
              <button onClick={() => { setSelectedWeek(focusDay.week); changeView("plan"); }}>
                查看本周详情 <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="week-strip">
              {focusWeek.days.map((item) => {
                const isDone = completed.has(item.day);
                const isFocus = item.day === focusDay.day;
                return (
                  <button
                    key={item.day}
                    className={`${isDone ? "done" : ""} ${isFocus ? "focus" : ""}`}
                    onClick={() => showDay(item.day)}
                    aria-label={`查看第 ${item.day} 天任务`}
                  >
                    <span>{item.date.replace(" 月 ", "/").replace(" 日", "")}</span>
                    <b>{isDone ? <CheckIcon /> : String(item.day).padStart(2, "0")}</b>
                    <em>{isFocus ? "下一步" : isDone ? "完成" : "待学"}</em>
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeView === "plan" && (
        <section
          className="view-panel plan-view"
          id="panel-plan"
          role="tabpanel"
          aria-labelledby="tab-plan"
        >
          <div className="view-intro compact">
            <div>
              <p className="overline">12-WEEK PLAN</p>
              <h1>一次只看一周。</h1>
            </div>
            {hasLocalData && (
              <button className="reset-button" onClick={resetProgress}>清除全部进度</button>
            )}
          </div>

          <div className="week-picker" aria-label="选择周次">
            {weeks.map(({ week, days }) => {
              const done = days.filter((item) => completed.has(item.day)).length;
              return (
                <button
                  key={week}
                  className={selectedWeek === week ? "active" : ""}
                  onClick={() => setSelectedWeek(week)}
                  aria-pressed={selectedWeek === week}
                >
                  <span>W{String(week).padStart(2, "0")}</span>
                  <b>{days[0].phase}</b>
                  <em>{done}/7</em>
                </button>
              );
            })}
          </div>

          <div className="selected-week-heading">
            <div>
              <span>第 {selectedWeek} 周</span>
              <h2>{selectedWeekData.days[0].phase}</h2>
            </div>
            <p>{selectedWeekData.days[0].date} — {selectedWeekData.days.at(-1)!.date}</p>
          </div>

          <div className="day-list">
            {selectedWeekData.days.map((item) => {
              const isDone = completed.has(item.day);
              return (
                <article className={`day-item ${isDone ? "completed" : ""}`} key={item.day}>
                  <div className="day-index">
                    <span>DAY</span>
                    <strong>{String(item.day).padStart(2, "0")}</strong>
                  </div>
                  <div className="day-detail">
                    <div>
                      <time>{item.date}</time>
                      <span className={`phase-pin ${phaseClass(item.phase)}`} />
                    </div>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.course} <ArrowIcon />
                    </a>
                    <p>{item.task}</p>
                    <div className="day-record-meta">
                      {(focusMinutes[item.day] ?? 0) > 0 && <span>专注 {focusMinutes[item.day]} 分钟</span>}
                      {notes[item.day] && <span>已有学习笔记</span>}
                    </div>
                    <details className="day-note">
                      <summary>{notes[item.day] ? "编辑笔记" : "添加笔记"}</summary>
                      <textarea
                        value={notes[item.day] ?? ""}
                        onChange={(event) => updateNote(item.day, event.target.value)}
                        placeholder="记录这一天的关键理解或疑问……"
                        maxLength={500}
                      />
                    </details>
                  </div>
                  <label className="row-check">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleDay(item.day)}
                      aria-label={`标记第 ${item.day} 天为${isDone ? "未完成" : "已完成"}`}
                    />
                    <span className="row-check-box" aria-hidden="true"><CheckIcon /></span>
                    <b>{isDone ? "已完成" : "完成"}</b>
                  </label>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeView === "notes" && (
        <section
          className="view-panel notes-view"
          id="panel-notes"
          role="tabpanel"
          aria-labelledby="tab-notes"
        >
          <div className="view-intro compact">
            <div>
              <p className="overline">LEARNING NOTES</p>
              <h1>把每天的理解串起来。</h1>
            </div>
            <p>这里汇总所有逐日笔记；输入课程、阶段或关键词即可搜索。</p>
          </div>

          <div className="notes-toolbar">
            <div className="notes-stats">
              <span><b>{noteCount}</b><em>篇笔记</em></span>
              <span><b>{noteCharacters}</b><em>累计字数</em></span>
            </div>
            <label className="notes-search" htmlFor="notes-search-input">
              <span>搜索笔记</span>
              <input
                id="notes-search-input"
                type="search"
                value={noteQuery}
                onChange={(event) => setNoteQuery(event.target.value)}
                placeholder="例如：递归、Python、Day 12"
              />
            </label>
          </div>

          {notedDays.length > 0 ? (
            <div className="notes-list">
              {notedDays.map((item) => (
                <article className="note-entry" key={item.day}>
                  <div className="note-entry-index">
                    <span>DAY</span>
                    <strong>{String(item.day).padStart(2, "0")}</strong>
                    <time>{item.date}</time>
                  </div>
                  <div className="note-entry-content">
                    <span className={`phase-badge ${phaseClass(item.phase)}`}>{item.phase}</span>
                    <h2>{item.course}</h2>
                    <p>{notes[item.day]}</p>
                    <div>
                      <a href={item.url} target="_blank" rel="noreferrer">打开课程 <ArrowIcon /></a>
                      <button onClick={() => showDay(item.day)}>查看对应计划 →</button>
                    </div>
                  </div>
                  {(focusMinutes[item.day] ?? 0) > 0 && (
                    <span className="note-focus-time">专注 {focusMinutes[item.day]} 分钟</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="notes-empty">
              <span aria-hidden="true">“ ”</span>
              <h2>{noteCount === 0 ? "还没有学习笔记" : "没有匹配的笔记"}</h2>
              <p>{noteCount === 0 ? "在“今天”或“计划”里记录一句关键理解，内容会自动出现在这里。" : "换一个更短的关键词试试。"}</p>
              {noteCount === 0 && <button onClick={() => changeView("today")}>去记录今天的笔记</button>}
            </div>
          )}
        </section>
      )}

      {activeView === "progress" && (
        <section
          className="view-panel progress-view"
          id="panel-progress"
          role="tabpanel"
          aria-labelledby="tab-progress"
        >
          <div className="view-intro compact">
            <div>
              <p className="overline">84-DAY MAP</p>
              <h1>你的学习轨迹。</h1>
            </div>
            <div className="progress-intro-actions">
              <p>点击任意一天，直接查看对应任务。</p>
              <div>
                <button onClick={exportBackup}>导出备份</button>
                <label>
                  导入备份
                  <input type="file" accept="application/json,.json" onChange={importBackup} />
                </label>
              </div>
            </div>
          </div>

          <div className="progress-dashboard">
            <div className="progress-score">
              <span>总进度</span>
              <strong>{percentage}<i>%</i></strong>
              <p>{completed.size} 天完成 · 还有 {studyDays.length - completed.size} 天</p>
              <ul>
                <li><b>{completedSequence}</b><span>连续完成</span></li>
                <li><b>{totalFocusMinutes}</b><span>专注分钟</span></li>
              </ul>
              <div><b style={{ width: `${percentage}%` }} /></div>
            </div>

            <div className="phase-progress-list">
              {phaseProgress.map(({ phase, done, total }) => (
                <div className="phase-progress-row" key={phase}>
                  <span className={`phase-pin ${phaseClass(phase)}`} />
                  <div>
                    <b>{phase}</b>
                    <em>{phaseNotes[phase]}</em>
                  </div>
                  <strong>{done}/{total}</strong>
                  <i><b style={{ width: `${(done / total) * 100}%` }} /></i>
                </div>
              ))}
            </div>
          </div>

          <div className="day-map-wrap">
            <div className="day-map-heading">
              <h2>84 天全景</h2>
              <div><span className="done-key" /> 已完成 <span className="next-key" /> 下一步</div>
            </div>
            <div className="day-map" aria-label="84 天学习轨迹">
              {studyDays.map((item) => {
                const isDone = completed.has(item.day);
                const isFocus = item.day === focusDay.day;
                return (
                  <button
                    key={item.day}
                    className={`${phaseClass(item.phase)} ${isDone ? "done" : ""} ${isFocus ? "focus" : ""}`}
                    onClick={() => showDay(item.day)}
                    aria-label={`第 ${item.day} 天，${item.date}，${isDone ? "已完成" : "未完成"}`}
                    title={`Day ${item.day} · ${item.date}`}
                  >
                    {isDone ? <CheckIcon /> : item.day}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <footer className="app-footer">
        <button onClick={() => setSyncPanelOpen(true)}>
          <span className={`footer-sync-dot status-${syncStatus}`} aria-hidden="true" />
          {user ? `${syncLabel} · ${user.email ?? "已登录"}` : "当前仅保存在此设备 · 登录后跨设备同步"}
        </button>
        <p>先完成，再优化。</p>
      </footer>
    </main>
  );
}
