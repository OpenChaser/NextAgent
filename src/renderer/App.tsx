import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { AutomationView } from './components/AutomationView'
import { SettingsView } from './components/SettingsView'
import { MemoryView } from './components/MemoryView'

export default function App() {
  const [activeTab, setActiveTab] = useState('new-task')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const loaded = await window.electronAPI.getTasks()
        setTasks(loaded)
      } catch (error) {
        console.error('Failed to load tasks:', error)
      }
    }
    loadTasks()
  }, [])

  const ensureTask = useCallback(async (): Promise<string | null> => {
    const now = Date.now()
    const newTask: TaskItem = {
      id: `task-${now}`,
      title: '新任务',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    const ok = await window.electronAPI.addTask(newTask)
    if (!ok) return null
    setTasks((prev) => [newTask, ...prev])
    setCurrentTaskId(newTask.id)
    return newTask.id
  }, [])

  const createTask = useCallback(() => {
    setCurrentTaskId(null)
    setActiveTab('new-task')
    window.electronAPI.resetSession()
  }, [])

  const selectTask = useCallback((taskId: string) => {
    setCurrentTaskId(taskId)
    setActiveTab('new-task')
    window.electronAPI.resetSession()
  }, [])

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId)
      window.electronAPI.deleteTask(taskId)
      return next
    })
    setCurrentTaskId((curr) => {
      if (curr !== taskId) return curr
      return null
    })
  }, [])

  const handleTitleGenerated = useCallback((taskId: string, title: string) => {
    if (!title) return
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, title } : t))
      const target = next.find((t) => t.id === taskId)
      if (target) {
        window.electronAPI.updateTask(target)
      }
      return next
    })
  }, [])

  const handleMessagesChange = useCallback((taskId: string, messages: any[]) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, messages, updatedAt: Date.now() } : t
      )
      const target = next.find((t) => t.id === taskId)
      if (target) {
        window.electronAPI.updateTask(target)
      }
      return next
    })
  }, [])

  const currentTask = tasks.find((t) => t.id === currentTaskId) ?? null

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tasks={tasks}
        currentTaskId={currentTaskId}
        onCreateTask={createTask}
        onSelectTask={selectTask}
        onDeleteTask={deleteTask}
      />
      <div className="flex-1 flex flex-col">
        {activeTab === 'automation' ? (
          <AutomationView />
        ) : activeTab === 'settings' ? (
          <SettingsView onBack={() => setActiveTab('new-task')} />
        ) : activeTab === 'memory' ? (
          <MemoryView onBack={() => setActiveTab('new-task')} />
        ) : (
          <ChatArea
            taskId={currentTaskId}
            initialMessages={currentTask?.messages ?? []}
            onTitleGenerated={handleTitleGenerated}
            onMessagesChange={handleMessagesChange}
            onEnsureTask={ensureTask}
          />
        )}
      </div>
    </div>
  )
}
