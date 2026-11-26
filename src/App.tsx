import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  BarChart3,
  BellRing,
  Columns3,
  LogOut,
  Menu,
  Plus,
  X,
} from 'lucide-react';
import { auth } from './lib/firebase';
import {
  completeTask,
  createLead,
  createTask,
  DEFAULT_MONTHLY_GOAL,
  deleteLeadCascade,
  deleteTask,
  moveLeadStage,
  rescheduleTask,
  saveUserProfile,
  seedSampleCrmData,
  subscribeLeads,
  subscribeTasks,
  subscribeUserProfile,
  updateLeadDetails,
} from './services/crmService';
import type {
  FollowUpTask,
  Lead,
  LeadInput,
  LeadStage,
  TaskInput,
  UserProfile,
} from './types/crm';
import { isTaskOverdue } from './utils/formatters';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { KanbanBoard } from './components/KanbanBoard';
import { LeadModal } from './components/LeadModal';
import { LeadDrawer } from './components/LeadDrawer';
import { FollowUpsView } from './components/FollowUpsView';
import { ReportsView } from './components/ReportsView';
import { ReminderBanner } from './components/ReminderBanner';

type ActiveSection = 'pipeline' | 'followups' | 'relatorios';

function CrmWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeSection, setActiveSection] = useState<ActiveSection>('pipeline');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [newLeadModalStage, setNewLeadModalStage] = useState<LeadStage | null>(null);

  // Live reminder clock (ticks every 30s)
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(() => new Set());
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
  );
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Surface async subscription errors into ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setLeads([]);
      setTasks([]);
      setProfile(null);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    let leadsLoaded = false;

    const unsubProfile = subscribeUserProfile(
      user.uid,
      (p) => setProfile(p),
      (err) => setFatalError(err),
    );

    const unsubLeads = subscribeLeads(
      user.uid,
      (items) => {
        setLeads(items);
        if (!leadsLoaded) {
          leadsLoaded = true;
          setLoadingData(false);
        }
      },
      (err) => setFatalError(err),
    );

    const unsubTasks = subscribeTasks(
      user.uid,
      (items) => setTasks(items),
      (err) => setFatalError(err),
    );

    return () => {
      unsubProfile();
      unsubLeads();
      unsubTasks();
    };
  }, [authReady, user]);

  const dueReminderTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          isTaskOverdue(t.dueDate, t.status, nowMs) && !dismissedReminderIds.has(t.id),
      ),
    [tasks, nowMs, dismissedReminderIds],
  );

  const pendingTaskCount = useMemo(
    () => tasks.filter((t) => t.status === 'pendente').length,
    [tasks],
  );

  // Trigger optional browser desktop notification when a reminder becomes due
  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission !== 'granted') return;

    for (const task of dueReminderTasks) {
      if (notifiedIdsRef.current.has(task.id)) continue;
      notifiedIdsRef.current.add(task.id);
      try {
        new Notification(`Follow-up: ${task.leadName}`, {
          body: task.title,
        });
      } catch {
        // Browser iframe may restrict Notification constructor
      }
    }
  }, [dueReminderTasks, notificationsEnabled]);

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  async function handleCreateLead(input: LeadInput) {
    if (!user) return;
    const colCount = leads.filter((l) => l.stage === input.stage).length;
    await createLead(user.uid, input, colCount);
  }

  async function handleMoveLead(lead: Lead, targetStage: LeadStage) {
    const colCount = leads.filter((l) => l.stage === targetStage).length;
    await moveLeadStage(lead.id, targetStage, colCount, lead.closedMonth);
  }

  async function handleUpdateLead(
    lead: Lead,
    input: LeadInput,
    pendingLeadTasks: FollowUpTask[],
  ) {
    await updateLeadDetails(lead, input, pendingLeadTasks);
  }

  async function handleDeleteLead(lead: Lead, leadTasks: FollowUpTask[]) {
    if (!user) return;
    await deleteLeadCascade(user.uid, lead.id, leadTasks);
  }

  async function handleCreateTask(input: TaskInput) {
    if (!user) return;
    await createTask(user.uid, input);
  }

  async function handleSaveGoal(newGoal: number) {
    if (!user) return;
    await saveUserProfile(user.uid, user.displayName || 'Usuário', newGoal, profile !== null);
  }

  async function handleSeedSampleData() {
    if (!user) return;
    setSeeding(true);
    try {
      await seedSampleCrmData(user.uid, user.displayName || 'Usuário', profile !== null);
    } finally {
      setSeeding(false);
    }
  }

  function handleEnableNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    void Notification.requestPermission().then((perm) => {
      setNotificationsEnabled(perm === 'granted');
    });
  }

  function handleOpenLeadById(leadId: string) {
    const exists = leads.some((l) => l.id === leadId);
    if (exists) {
      setSelectedLeadId(leadId);
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="text-sm text-[#6B7280]">Carregando workspace...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const sectionMeta: Record<ActiveSection, { breadcrumb: string; title: string }> = {
    pipeline: { breadcrumb: 'Comercial / Pipeline', title: 'Pipeline de Vendas' },
    followups: { breadcrumb: 'Comercial / Follow-ups', title: 'Tarefas e Lembretes' },
    relatorios: { breadcrumb: 'Comercial / Relatórios', title: 'Relatórios Mensais' },
  };

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: typeof Columns3;
    count?: number;
  }> = [
    { id: 'pipeline', label: 'Pipeline', icon: Columns3, count: leads.length },
    { id: 'followups', label: 'Follow-ups', icon: BellRing, count: pendingTaskCount },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];

  const monthlyGoal = profile?.monthlyGoal ?? DEFAULT_MONTHLY_GOAL;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-[#E5E7EB]">
        <div className="h-16 px-6 flex items-center border-b border-[#E5E7EB]">
          <span className="text-base font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 font-[var(--font-display)]">
            Vértice CRM
          </span>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#EFF6FF] text-[#1D4ED8]'
                    : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="text-xs font-mono tabular-nums text-[#6B7280]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#111827] truncate">
                {user.displayName || 'Usuário'}
              </p>
              <p className="text-[11px] text-[#6B7280] truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="p-2 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#111827]/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 bg-white h-full border-r border-[#E5E7EB] flex flex-col">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#E5E7EB]">
              <span className="text-base font-bold text-[#111827] font-[var(--font-display)]">
                Vértice CRM
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-1.5 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg cursor-pointer ${
                      active ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'text-[#4B5563] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && (
                      <span className="text-xs font-mono tabular-nums text-[#6B7280]">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
              <span className="text-xs text-[#6B7280] truncate">{user.email}</span>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="text-xs font-medium text-[#B91C1C] cursor-pointer whitespace-nowrap"
              >
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="no-print h-16 bg-white border-b border-[#E5E7EB] px-4 sm:px-8 flex items-center justify-between gap-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="lg:hidden p-2 -ml-2 text-[#4B5563] hover:text-[#111827] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-[#6B7280] truncate">
                {sectionMeta[activeSection].breadcrumb}
              </p>
              <h1 className="text-base font-semibold text-[#111827] truncate leading-tight">
                {sectionMeta[activeSection].title}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNewLeadModalStage('novo')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">
          <ReminderBanner
            dueTasks={dueReminderTasks}
            onOpenLead={handleOpenLeadById}
            onCompleteTask={completeTask}
            onSnoozeTask={rescheduleTask}
            onDismiss={(taskId) =>
              setDismissedReminderIds((prev) => new Set(prev).add(taskId))
            }
          />

          {activeSection === 'pipeline' && (
            <KanbanBoard
              leads={leads}
              tasks={tasks}
              loading={loadingData}
              seeding={seeding}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onOpenNewLead={(stage) => setNewLeadModalStage(stage)}
              onMoveLead={handleMoveLead}
              onSeedSampleData={handleSeedSampleData}
            />
          )}

          {activeSection === 'followups' && (
            <FollowUpsView
              leads={leads}
              tasks={tasks}
              nowMs={nowMs}
              notificationsEnabled={notificationsEnabled}
              onEnableNotifications={handleEnableNotifications}
              onCreateTask={handleCreateTask}
              onCompleteTask={completeTask}
              onSnoozeTask={rescheduleTask}
              onDeleteTask={deleteTask}
              onOpenLead={handleOpenLeadById}
            />
          )}

          {activeSection === 'relatorios' && (
            <ReportsView
              leads={leads}
              monthlyGoal={monthlyGoal}
              onSaveGoal={handleSaveGoal}
            />
          )}
        </main>
      </div>

      {/* Create Lead Modal */}
      {newLeadModalStage && (
        <LeadModal
          initialStage={newLeadModalStage}
          onClose={() => setNewLeadModalStage(null)}
          onSubmit={handleCreateLead}
        />
      )}

      {/* Lead Detail Slide-Over Drawer */}
      {selectedLead && (
        <LeadDrawer
          uid={user.uid}
          lead={selectedLead}
          tasks={tasks}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={handleDeleteLead}
          onQuickMoveStage={handleMoveLead}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CrmWorkspace />
    </ErrorBoundary>
  );
}
