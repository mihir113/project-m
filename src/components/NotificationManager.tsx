"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "last-overdue-notification-date";
const CHECK_INTERVAL_MS = 60_000; // 1 minute
const TARGET_HOUR = 12; // 12 PM
const TIMEZONE = "America/Denver"; // US Mountain Time

function getMountainTime(): { hour: number; minute: number; dateStr: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return {
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

async function checkAndNotify() {
  const { hour, minute, dateStr } = getMountainTime();

  // Only fire at 12:00 PM Mountain Time (within the 1-minute check window)
  if (hour !== TARGET_HOUR || minute !== 0) return;

  // Already notified today
  try {
    const last = localStorage.getItem(STORAGE_KEY);
    if (last === dateStr) return;
  } catch {
    return;
  }

  // Check notification permission
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "denied") return;

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    if (result !== "granted") return;
  }

  // Fetch overdue tasks
  try {
    const res = await fetch("/api/requirements?status=overdue");
    const json = await res.json();
    const overdueTasks = (json.data || []).filter(
      (t: any) => t.status === "overdue" || (t.status === "pending" && t.dueDate && new Date(t.dueDate + "T23:59:59") < new Date())
    );
    const count = overdueTasks.length;

    if (count === 0) {
      // No overdue tasks, still mark as checked today
      localStorage.setItem(STORAGE_KEY, dateStr);
      return;
    }

    const body = `You have ${count} overdue ${count === 1 ? "task" : "tasks"} that need attention.`;

    new Notification("Mihir - Overdue Tasks Alert", {
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: "overdue-tasks-daily",
    });

    localStorage.setItem(STORAGE_KEY, dateStr);
  } catch {
    // Network error — silently skip, will retry next minute
  }
}

export function NotificationManager() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Initial check after a short delay (let app hydrate first)
    const timeout = setTimeout(checkAndNotify, 5000);

    // Then check every minute
    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Also prompt for notification permission on first page interaction
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;

    const handler = () => {
      Notification.requestPermission();
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null; // Invisible component
}
