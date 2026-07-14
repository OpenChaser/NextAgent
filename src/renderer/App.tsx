import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { AutomationView } from './components/AutomationView'
import { SettingsView } from './components/SettingsView'

export default function App() {
  const [activeTab, setActiveTab] = useState('new-task')

  return (
    <div className="flex h-screen bg-white">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col">
        {activeTab === 'automation' ? (
          <AutomationView />
        ) : activeTab === 'settings' ? (
          <SettingsView onBack={() => setActiveTab('new-task')} />
        ) : (
          <ChatArea />
        )}
      </div>
    </div>
  )
}