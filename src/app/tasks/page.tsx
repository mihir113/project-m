"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

interface Task {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  name: string;
  description: string | null;
  type: string;
  recurrence: string | null;
  dueDate: string;
  status: string;
  ownerId: string | null;
  ownerNick: string | null;
}

interface GroupedTasks {
  [projectId: string]: {
    projectName: string;
    projectColor: string;
    tasks: Task[];
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchTasks = async () => {
    try {
      // Fetch all projects to get all their pending tasks
      const projectsRes = await fetch("/api/projects");
      const projectsJson = await projectsRes.json();
      const projects = projectsJson.data || [];

      // Fetch pending tasks for all projects
      const allTasks: Task[] = [];
      for (const project of projects) {
        const tasksRes = await fetch(`/api/requirements?projectId=${project.id}&status=pending`);
        const tasksJson = await tasksRes.json();
        const projectTasks = (tasksJson.data || []).map((t: any) => ({
          ...t,
          projectName: project.name,
          projectColor: project.color,
        }));
        allTasks.push(...projectTasks);
      }

      // Sort by due date (earliest first)
      allTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setTasks(allTasks);
    } catch {
      showToast("Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleComplete = async (task: Task) => {
    setCompletingTask(task.id);
    try {
      await fetch("/api/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: "completed" }),
      });
      showToast("Task completed", "success");
      await fetchTasks();
    } catch {
      showToast("Failed to complete task", "error");
    } finally {
      setCompletingTask(null);
    }
  };

  // Group tasks by project
  const groupedTasks = tasks.reduce<GroupedTasks>((acc, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = {
        projectName: task.projectName,
        projectColor: task.projectColor,
        tasks: [],
      };
    }
    acc[task.projectId].tasks.push(task);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">My Tasks</h1>
        <p className="text-secondary text-sm mt-1">
          {tasks.length} open task{tasks.length !== 1 ? "s" : ""} across {Object.keys(groupedTasks).length} project{Object.keys(groupedTasks).length !== 1 ? "s" : ""}
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-muted text-sm mb-3">No open tasks! 🎉</p>
          <Link href="/projects" className="btn-primary">
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([projectId, { projectName, projectColor, tasks }]) => (
            <div key={projectId} className="card p-4">
              {/* Project Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-default">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
                <h2 className="text-base font-semibold text-primary flex-1">{projectName}</h2>
                <span className="text-xs text-muted">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</span>
                <Link
                  href={`/projects/${projectId}`}
                  className="text-xs font-medium"
                  style={{ color: projectColor }}
                >
                  View Project →
                </Link>
              </div>

              {/* Tasks List */}
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg"
                    style={{ backgroundColor: "#1e2130" }}
                  >
                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <p className="text-primary text-sm font-medium">{task.name}</p>
                        {task.recurrence && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs flex-shrink-0"
                            style={{ backgroundColor: "#171923", color: "#fbbf24" }}
                          >
                            ↻ {task.recurrence}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-muted text-xs mb-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-secondary">
                        <span>Due: {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        {task.ownerNick && <span>• {task.ownerNick}</span>}
                      </div>
                    </div>

                    {/* Complete Button */}
                    <button
                      onClick={() => handleComplete(task)}
                      disabled={completingTask === task.id}
                      className="btn-primary text-xs whitespace-nowrap"
                      style={{ minWidth: "100px" }}
                    >
                      {completingTask === task.id ? "Completing..." : "✓ Complete"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
