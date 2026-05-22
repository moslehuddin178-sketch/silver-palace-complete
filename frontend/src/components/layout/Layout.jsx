import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChatbotWidget from '../ui/ChatbotWidget';

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-60 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}