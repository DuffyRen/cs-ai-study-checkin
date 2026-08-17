"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage is restored after hydration. */

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { studyDays } from "./studyData";

const STORAGE_KEY = "cs-ai-study-checkin-v1";
const DETAILS_STORAGE_KEY = "cs-ai-study-details-v1";
const FOCUS_SECONDS = 25 * 60;

const phaseNotes: Record<string, string> = {
  "Python 基础": "先把代码写起来",
  "数据结构与算法": "理解程序背后的结构",
  "Python 项目": "做出能重复使用的工具",
  机器学习: "体验数据到预测的完整流程",
  "LLM 与 Agent": "把模型、工具与行动连接起来",
};

type ViewKey = "today" | "plan" | "progress";

const views: Array<{ id: ViewKey; label: string; hint: string }> = [
  { id: "today", label: "今天", hint: "现在做什么" },
  { id: "plan", label: "计划", hint: "按周查看" },
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

export default function Home() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("today");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [focusMinutes, setFocusMinutes] = useState<Record<number, number>>({});
  const [timerSeconds, setTimerSeconds] = useState(FOCUS_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const savedDays = new Set<number>(
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
      if (savedDetails) {
        const parsedDetails = JSON.parse(savedDetails);
        if (parsedDetails && typeof parsedDetails === "object") {
          setNotes(cleanNotes(parsedDetails.notes));
          setFocusMinutes(cleanMinutes(parsedDetails.focusMinutes));
        }
      }
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
        JSON.stringify({ notes, focusMinutes }),
      );
    } catch {
      // Keep notes and timer usable in-session when storage is unavailable.
    }
  }, [focusMinutes, notes, ready]);

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
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusDay.day, timerRunning]);

  function toggleDay(day: number) {
    setCompleted((current) => {
      const updated = new Set(current);
      if (updated.has(day)) updated.delete(day);
      else updated.add(day);
      return updated;
    });
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
      window.alert("学习记录已恢复。");
    } catch {
      window.alert("无法导入：请选择由本网页导出的 JSON 备份文件。");
    }
  }

  function resetProgress() {
    if (window.confirm("确定清除这台设备上的打卡、笔记和专注时长吗？")) {
      setCompleted(new Set());
      setNotes({});
      setFocusMinutes({});
      resetTimer();
      setSelectedWeek(1);
      setActiveView("today");
    }
  }

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

        <button className="header-progress" onClick={() => changeView("progress")}>
          <span>{completed.size} / 84</span>
          <i><b style={{ width: `${percentage}%` }} /></i>
        </button>
      </header>

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
        <span>进度仅保存在当前浏览器</span>
        <p>先完成，再优化。</p>
      </footer>
    </main>
  );
}
