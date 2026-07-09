import { useState, useEffect, useLayoutEffect } from 'react'
import { onAuthChange, signOutUser, type User } from './utils/auth'
import { useStore } from './store/useStore'
import type { Tab, Expense, Trip } from './types'
import Header from './components/Header'
import TabBar from './components/TabBar'
import TripModal from './components/TripModal'
import Dashboard from './components/dashboard/Dashboard'
import AddExpenseForm from './components/add/AddExpenseForm'
import ExpenseList from './components/expenses/ExpenseList'
import PeopleTab from './components/people/PeopleTab'
import LoginScreen from './components/auth/LoginScreen'
import { getInitialTheme, applyTheme, type Theme } from './utils/theme'
import UnauthorizedScreen from './components/auth/UnauthorizedScreen'
import JoinTripScreen from './components/join/JoinTripScreen'

const ALLOWED_UIDS = (import.meta.env.VITE_ALLOWED_UIDS ?? '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean)

const PENDING_JOIN_KEY = 'tet_pending_join'

// Read the ?join= invite param once at startup. Persisted to sessionStorage
// so the pending join survives the Google sign-in popup/redirect.
function readPendingJoin(): string | null {
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('join')
  if (fromUrl) {
    sessionStorage.setItem(PENDING_JOIN_KEY, fromUrl)
    history.replaceState(null, '', location.pathname)
    return fromUrl
  }
  return sessionStorage.getItem(PENDING_JOIN_KEY)
}

export default function App() {
  // undefined = auth still initializing, null = signed out, User = signed in
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  useLayoutEffect(() => applyTheme(theme), [theme])

  const [showTripModal, setShowTripModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | undefined>()
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>()
  const [pendingJoin, setPendingJoin] = useState<string | null>(readPendingJoin)

  useEffect(() => {
    return onAuthChange(setUser)
  }, [])

  const store = useStore(user?.uid ?? null)

  function handleTabChange(t: Tab) {
    setTab(t)
    if (t !== 'add') setEditingExpense(undefined)
  }

  function handleEditExpense(expense: Expense) {
    setEditingExpense(expense)
    setTab('add')
  }

  function handleJoinDone(tripId: string | null) {
    sessionStorage.removeItem(PENDING_JOIN_KEY)
    setPendingJoin(null)
    if (tripId) store.setActiveTrip(tripId)
  }

  if (user === undefined || (user !== null && store.loading)) {
    return (
      <div className="flex items-center justify-center bg-[var(--bg)]" style={{ minHeight: '100dvh' }}>
        <div className="text-[var(--muted)] text-sm">{user === undefined ? 'Loading…' : 'Loading your trips…'}</div>
      </div>
    )
  }

  if (user === null) {
    return <LoginScreen joinPending={!!pendingJoin} />
  }

  if (ALLOWED_UIDS.length > 0 && !ALLOWED_UIDS.includes(user.uid)) {
    return <UnauthorizedScreen email={user.email} />
  }

  if (pendingJoin) {
    return <JoinTripScreen tripId={pendingJoin} user={user} onDone={handleJoinDone} />
  }

  const noTrip = store.trips.length === 0
  const isOwner = store.activeTrip?.ownerUid === user.uid

  return (
    <div className="flex flex-col bg-[var(--bg)]" style={{ minHeight: '100dvh' }}>
      <Header
        activeTrip={store.activeTrip}
        trips={store.trips}
        onSelectTrip={store.setActiveTrip}
        onNewTrip={() => setShowTripModal(true)}
        onEditTrip={(trip) => setEditingTrip(trip)}
        onDeleteTrip={store.deleteTrip}
        currentUid={user.uid}
        userPhotoURL={user.photoURL}
        onSignOut={signOutUser}
        isDark={theme === 'dark'}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="flex-1 overflow-y-auto">
        {noTrip ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <span className="text-6xl mb-4">✈️</span>
            <h1 className="text-xl font-semibold text-[var(--ink)] mb-2">Welcome to TripTracker</h1>
            <p className="text-[var(--muted)] text-sm mb-6">
              Create your first trip to start tracking expenses with your group.
            </p>
            <button
              onClick={() => setShowTripModal(true)}
              className="px-6 py-3 rounded-full bg-[var(--action)] text-white font-medium text-base active:scale-95 transition-transform"
            >
              + Create Trip
            </button>
          </div>
        ) : !store.activeTrip ? null : (
          <>
            {tab === 'dashboard' && (
              <Dashboard trip={store.activeTrip} expenses={store.activeExpenses} />
            )}
            {tab === 'add' && (
              <AddExpenseForm
                trip={store.activeTrip}
                editExpense={editingExpense}
                onSave={(expense) => {
                  if (editingExpense) {
                    store.updateExpense({ ...expense, createdByUid: editingExpense.createdByUid })
                  } else {
                    store.addExpense(expense)
                  }
                  setEditingExpense(undefined)
                  setTab('expenses')
                }}
                onCancel={() => {
                  setEditingExpense(undefined)
                  setTab('expenses')
                }}
              />
            )}
            {tab === 'expenses' && (
              <ExpenseList
                expenses={store.activeExpenses}
                trip={store.activeTrip}
                currentUid={user.uid}
                isOwner={isOwner}
                onEdit={handleEditExpense}
                onDelete={store.deleteExpense}
              />
            )}
            {tab === 'people' && (
              <PeopleTab
                trip={store.activeTrip}
                expenses={store.activeExpenses}
                currentUid={user.uid}
                isOwner={isOwner}
                onAddMember={(member) => store.addMember(store.activeTrip!.id, member)}
                onAddMembers={(members) => store.addMembers(store.activeTrip!.id, members)}
                onRemoveMember={(memberId) => store.removeMember(store.activeTrip!.id, memberId)}
                onToggleSettlementPaid={(from, to) => store.toggleSettlementPaid(store.activeTrip!.id, from, to)}
              />
            )}
          </>
        )}
      </main>

      {!noTrip && <TabBar active={tab} onChange={handleTabChange} />}

      {showTripModal && (
        <TripModal
          onSave={(trip) => {
            // The creator is always the first member, linked to their account
            const ownerMember = {
              id: crypto.randomUUID(),
              name: user.displayName || user.email || 'Me',
              uid: user.uid,
              email: user.email ?? undefined,
              photoURL: user.photoURL ?? undefined,
            }
            store.addTrip({ ...trip, members: [ownerMember] })
            store.setActiveTrip(trip.id)
            setShowTripModal(false)
          }}
          onClose={() => setShowTripModal(false)}
        />
      )}

      {editingTrip && (
        <TripModal
          editTrip={editingTrip}
          onSave={(updated) => {
            store.updateTrip({ ...updated, ownerUid: editingTrip.ownerUid, memberUids: editingTrip.memberUids })
            setEditingTrip(undefined)
          }}
          onClose={() => setEditingTrip(undefined)}
        />
      )}
    </div>
  )
}
