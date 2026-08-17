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

function ArrowIcon() {
  return <span aria-hidden="true" className="arrow-icon">→</span>;
}

function CheckIcon() {
  return <span aria-hidden="true" className="check-icon">✓</span>;
}

export default function Home() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([1]));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCompleted(new Set(parsed.filter((day) => Number.isInteger(day))));
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

  function toggleDay(day: number) {
    setCompleted((current) => {
      const updated = new Set(current);
      if (updated.has(day)) updated.delete(day);
      else updated.add(day);
      return updated;
    });
  }

  function toggleWeek(week: number) {
    setOpenWeeks((current) => {
      const updated = new Set(current);
      if (updated.has(week)) updated.delete(week);
      else updated.add(week);
      return updated;
    });
  }

  function jumpToDay(day: number) {
    const item = studyDays[day - 1];
    setOpenWeeks((current) => new Set(current).add(item.week));
    window.setTimeout(() => {
      document.getElementById(`day-${day}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }

  function resetProgress() {
    if (window.confirm("确定清除这台设备上的全部打卡记录吗？")) {
      setCompleted(new Set());
      setOpenWeeks(new Set([1]));
    }
  }

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">计算机 / AI 二硕准备 · 84 天</p>
            <h1 id="page-title">
              把“想学”变成
              <span>每天完成一小步。</span>
            </h1>
            <p className="hero-intro">
              从 8 月 17 日开始，先写 Python，再理解算法，最后做出自己的 AI 项目。
              每天 60–90 分钟，勾选即保存。
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => jumpToDay(focusDay.day)}>
                继续第 {focusDay.day} 天
                <ArrowIcon />
              </button>
              <span className="save-note">进度保存在当前浏览器</span>
            </div>
          </div>

          <aside className="today-card" aria-label="今天的学习任务">
            <div className="today-card-top">
              <span className="today-label">
                {scheduledToday ? "今天" : "下一步"} · Day {focusDay.day}
              </span>
              <time>{focusDay.date}</time>
            </div>
            <p className="today-phase">{focusDay.phase}</p>
            <h2>{focusDay.course}</h2>
            <p className="today-task">{focusDay.task}</p>
            <div className="today-actions">
              <a href={focusDay.url} target="_blank" rel="noreferrer">
                打开今天的课程 <ArrowIcon />
              </a>
              <label className="hero-check">
                <span>完成今天</span>
                <input
                  type="checkbox"
                  checked={completed.has(focusDay.day)}
                  onChange={() => toggleDay(focusDay.day)}
                />
                <span className="custom-check" aria-hidden="true">
                  <CheckIcon />
                </span>
              </label>
            </div>
          </aside>
        </div>
      </section>

      <section className="progress-section" aria-labelledby="progress-title">
        <div className="section-heading progress-heading">
          <div>
            <p className="section-kicker">你的学习轨迹</p>
            <h2 id="progress-title">84 格，走完一条新路径</h2>
          </div>
          <div className="progress-total" aria-live="polite">
            <strong>{completed.size}</strong>
            <span>/ 84 天完成</span>
          </div>
        </div>

        <div className="progress-layout">
          <div
            className="progress-ring"
            style={{ "--progress": `${percentage * 3.6}deg` } as React.CSSProperties}
            aria-label={`总进度 ${percentage}%`}
          >
            <div>
              <strong>{percentage}%</strong>
              <span>总进度</span>
            </div>
          </div>

          <div className="trail-wrap">
            <div className="trail" aria-label="84 天学习轨迹">
              {studyDays.map((item) => {
                const isDone = completed.has(item.day);
                const isFocus = item.day === focusDay.day;
                return (
                  <button
                    key={item.day}
                    className={`trail-day phase-${item.phase.replaceAll(" ", "-")} ${isDone ? "done" : ""} ${isFocus ? "focus" : ""}`}
                    onClick={() => jumpToDay(item.day)}
                    aria-label={`第 ${item.day} 天，${item.date}，${isDone ? "已完成" : "未完成"}`}
                    title={`Day ${item.day} · ${item.date}`}
                  >
                    {isDone ? <CheckIcon /> : item.day}
                  </button>
                );
              })}
            </div>
            <div className="phase-legend" aria-label="学习阶段图例">
              {Object.entries(phaseNotes).map(([phase, note]) => (
                <span key={phase}>
                  <i className={`phase-dot phase-${phase.replaceAll(" ", "-")}`} />
                  <b>{phase}</b>
                  <em>{note}</em>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="plan-section" aria-labelledby="plan-title">
        <div className="section-heading plan-heading">
          <div>
            <p className="section-kicker">每日计划</p>
            <h2 id="plan-title">从 8 月 17 日，到第 84 天</h2>
          </div>
          {completed.size > 0 && (
            <button className="reset-button" onClick={resetProgress}>
              清除进度
            </button>
          )}
        </div>

        <div className="week-list">
          {weeks.map(({ week, days }) => {
            const isOpen = openWeeks.has(week);
            const weekDone = days.filter((item) => completed.has(item.day)).length;
            const phase = days[0].phase;
            return (
              <article className={`week ${isOpen ? "open" : ""}`} key={week}>
                <button
                  className="week-header"
                  onClick={() => toggleWeek(week)}
                  aria-expanded={isOpen}
                  aria-controls={`week-${week}`}
                >
                  <span className="week-number">W{String(week).padStart(2, "0")}</span>
                  <span className="week-title">
                    <b>第 {week} 周 · {phase}</b>
                    <small>{days[0].date}—{days.at(-1)!.date}</small>
                  </span>
                  <span className="week-status">{weekDone} / 7</span>
                  <span className="week-toggle" aria-hidden="true">+</span>
                </button>

                <div className="week-days" id={`week-${week}`} hidden={!isOpen}>
                  {days.map((item) => {
                    const isDone = completed.has(item.day);
                    return (
                      <div
                        className={`day-row ${isDone ? "completed" : ""}`}
                        id={`day-${item.day}`}
                        key={item.day}
                      >
                        <div className="day-meta">
                          <span className="day-number">Day {String(item.day).padStart(2, "0")}</span>
                          <label className="date-check">
                            <time>{item.date}</time>
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => toggleDay(item.day)}
                              aria-label={`标记第 ${item.day} 天为${isDone ? "未完成" : "已完成"}`}
                            />
                            <span className="custom-check" aria-hidden="true">
                              <CheckIcon />
                            </span>
                          </label>
                        </div>
                        <div className="day-content">
                          <a href={item.url} target="_blank" rel="noreferrer" className="course-link">
                            {item.course} <ArrowIcon />
                          </a>
                          <p>{item.task}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer>
        <p>先完成，再优化。每天留下一个能运行的结果。</p>
        <span>CS / AI · 12 周学习打卡</span>
      </footer>
    </main>
  );
}
