"use client";

/* eslint-disable react-hooks/set-state-in-effect -- localStorage is restored after hydration. */

import { useEffect, useMemo, useState } from "react";
import { studyDays } from "./studyData";

const STORAGE_KEY = "cs-ai-study-checkin-v1";

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

export default function Home() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("today");
  const [selectedWeek, setSelectedWeek] = useState(1);

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

  const nextDay = useMemo(
    () => studyDays.find((item) => !completed.has(item.day)) ?? studyDays.at(-1)!,
    [completed],
  );

  const todayLabel = `${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`;
  const scheduledToday = studyDays.find((item) => item.date === todayLabel);
  const focusDay = scheduledToday && !completed.has(scheduledToday.day) ? scheduledToday : nextDay;
  const percentage = Math.round((completed.size / studyDays.length) * 100);

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

  function resetProgress() {
    if (window.confirm("确定清除这台设备上的全部打卡记录吗？")) {
      setCompleted(new Set());
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
              <a className="course-button" href={focusDay.url} target="_blank" rel="noreferrer">
                打开课程 <ArrowIcon />
              </a>
            </article>

            <aside className={`check-card ${completed.has(focusDay.day) ? "is-done" : ""}`}>
              <p>{completed.has(focusDay.day) ? "今天已完成" : "完成后在这里打勾"}</p>
              <label className="large-check">
                <input
                  type="checkbox"
                  checked={completed.has(focusDay.day)}
                  onChange={() => toggleDay(focusDay.day)}
                />
                <span className="large-check-box" aria-hidden="true"><CheckIcon /></span>
                <b>{completed.has(focusDay.day) ? "做得好，继续保持" : "标记为已完成"}</b>
              </label>
              <div className="week-meter">
                <span>本周进度</span>
                <strong>{focusWeekDone} / 7</strong>
                <i><b style={{ width: `${(focusWeekDone / 7) * 100}%` }} /></i>
              </div>
            </aside>
          </div>

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
            {completed.size > 0 && (
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
            <p>点击任意一天，直接查看对应任务。</p>
          </div>

          <div className="progress-dashboard">
            <div className="progress-score">
              <span>总进度</span>
              <strong>{percentage}<i>%</i></strong>
              <p>{completed.size} 天完成 · 还有 {studyDays.length - completed.size} 天</p>
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
