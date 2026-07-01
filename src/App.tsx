import { useState, useEffect } from 'react'
import { onAuthChange, signOutUser, type User } from './utils/auth'
import { useStore } from './store/useStore'
import type { Tab, Expense } from './types'
import Header from './components/Header'
import TabBar from './components/TabBar'
import TripModal from './components/TripModal'
import Dashboard from './components/dashboard/Dashboard'
import AddExpenseForm from './components/add/AddExpenseForm'
import ExpenseList from './components/expenses/ExpenseList'
import PeopleTab from './components/people/PeopleTab'
import LoginScreen from './components/auth/LoginScreen'

export default function App() {
  // undefined = auth still initializing, null = signed out, User = signed in
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showTripModal, setShowTripModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>()

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

  if (user === undefined || (user !== null && store.loading)) {
    return (
      <div className="flex items-center justify-center bg-slate-950" style={{ minHeight: '100dvh' }}>
        <div className="text-slate-500 text-sm">{user === undefined ? 'Loading…' : 'Loading your trips…'}</div>
      </div>
    )
  }

  if (user === null) {
    return <LoginScreen />
  }

  const noTrip = store.trips.length === 0

  return (
    <div className="flex flex-col bg-slate-950" style={{ minHeight: '100dvh' }}>
      <Header
        activeTrip={store.activeTrip}
        trips={store.trips}
        onSelectTrip={store.setActiveTrip}
        onNewTrip={() => setShowTripModal(true)}
        onDeleteTrip={store.deleteTrip}
        userPhotoURL={user.photoURL}
        onSignOut={signOutUser}
      />

      <main className="flex-1 overflow-y-auto">
        {noTrip ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
            <span className="text-6xl mb-4">✈️</span>
            <h1 className="text-xl font-bold text-white mb-2">Welcome to TripTracker</h1>
            <p className="text-slate-400 text-sm mb-6">
              Create your first trip to start tracking expenses with your group.
            </p>
            <button
              onClick={() => setShowTripModal(true)}
              className="px-6 py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-base"
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
                  if (editingExpense) store.updateExpense(expense)
                  else store.addExpense(expense)
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
                onEdit={handleEditExpense}
                onDelete={store.deleteExpense}
              />
            )}
            {tab === 'people' && (
              <PeopleTab
                trip={store.activeTrip}
                expenses={store.activeExpenses}
                onAddMember={(member) => store.addMember(store.activeTrip!.id, member)}
                onRemoveMember={(memberId) => store.removeMember(store.activeTrip!.id, memberId)}
              />
            )}
          </>
        )}
      </main>

      {!noTrip && <TabBar active={tab} onChange={handleTabChange} />}

      {showTripModal && (
        <TripModal
          onSave={(trip) => {
            store.addTrip(trip)
            store.setActiveTrip(trip.id)
            setShowTripModal(false)
          }}
          onClose={() => setShowTripModal(false)}
        />
      )}
    </div>
  )
}
