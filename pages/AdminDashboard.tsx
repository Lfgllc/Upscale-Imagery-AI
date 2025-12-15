import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storageService';
import { User, SupportTicket, Payout } from '../types';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState(StorageService.getMetrics());
  const [users, setUsers] = useState<User[]>(StorageService.getAllUsers());
  const [tickets, setTickets] = useState<SupportTicket[]>(StorageService.getTickets());
  const [payouts, setPayouts] = useState<Payout[]>(StorageService.getPayouts());
  
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'TICKETS' | 'FINANCE'>('OVERVIEW');
  const [replyText, setReplyText] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Filters
  const [ticketFilter, setTicketFilter] = useState<'ALL' | 'NEW' | 'RESOLVED'>('ALL');

  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState(0);

  // Payout State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<'PAYPAL' | 'BANK_TRANSFER'>('PAYPAL');
  const [payoutDestination, setPayoutDestination] = useState('');

  useEffect(() => {
    // Refresh data on mount
    refreshData();
  }, []);

  const refreshData = () => {
    setMetrics(StorageService.getMetrics());
    setUsers(StorageService.getAllUsers());
    setTickets(StorageService.getTickets());
    setPayouts(StorageService.getPayouts());
  };

  const handleReply = (ticketId: string) => {
    if (!replyText) return;
    
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const updatedReplies = [...ticket.adminReplies, replyText];
      StorageService.updateTicket(ticketId, { 
        adminReplies: updatedReplies,
        status: 'RESOLVED'
      });
      
      console.log(`[ADMIN EMAIL] Sending reply to ${ticket.email}: ${replyText}`);
      
      refreshData();
      setReplyText('');
      setSelectedTicketId(null);
      alert("Reply sent successfully");
    }
  };

  const handleDeactivate = (userId: string, currentStatus: boolean) => {
    if (window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
        StorageService.toggleUserStatus(userId, !currentStatus);
        refreshData();
    }
  };

  const startEditCredits = (user: User) => {
      setEditingUserId(user.id);
      setEditCredits(user.credits);
  };

  const saveCredits = () => {
      if (editingUserId !== null) {
          StorageService.adjustUserCredits(editingUserId, editCredits);
          setEditingUserId(null);
          refreshData();
      }
  };

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
        alert("Invalid amount");
        return;
    }
    if (!payoutDestination) {
        alert("Please enter a destination account");
        return;
    }

    try {
        StorageService.processPayout(amount, payoutMethod, payoutDestination);
        refreshData();
        setShowPayoutModal(false);
        setPayoutAmount('');
        setPayoutDestination('');
        alert("Payout processed successfully!");
    } catch (err: any) {
        alert(err.message);
    }
  };

  const MetricCard = ({ title, value, subtext }: { title: string, value: string | number, subtext?: string }) => (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
      <p className="mt-2 text-3xl font-extrabold text-navy-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-green-600 font-medium">{subtext}</p>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-navy-900">Admin Dashboard</h1>
        <div className="flex space-x-2 bg-white p-1 rounded-md border border-slate-200">
          {(['OVERVIEW', 'USERS', 'TICKETS', 'FINANCE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-navy-800 text-white' : 'text-slate-600 hover:text-navy-900'}`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Revenue" value={`$${metrics.totalRevenue.toFixed(2)}`} />
            <MetricCard title="Available Balance" value={`$${metrics.availableBalance.toFixed(2)}`} subtext="Ready for payout" />
            <MetricCard title="MRR" value={`$${metrics.mrr.toFixed(2)}`} subtext="Monthly Recurring" />
            <MetricCard title="Conversion Rate" value={`${metrics.conversionRate.toFixed(1)}%`} subtext="Free to Paid" />
            
            <MetricCard title="Total Users" value={metrics.totalUsers} subtext={`+${metrics.newUsersToday} today`} />
            <MetricCard title="Generations" value={metrics.totalGenerations} subtext={`${metrics.failedGenerations} failed`} />
            <MetricCard title="Free Previews" value={metrics.freeGenerations} />
            <MetricCard title="New Tickets" value={metrics.ticketsNew} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">Subscription Distribution</h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Basic Plan', count: metrics.activeSubs.BASIC, color: 'bg-blue-500' },
                            { label: 'Pro Plan', count: metrics.activeSubs.PRO, color: 'bg-camel-500' },
                            { label: 'Elite Plan', count: metrics.activeSubs.ELITE, color: 'bg-purple-500' }
                        ].map(stat => (
                            <div key={stat.label}>
                                <div className="flex justify-between items-center text-sm">
                                    <span>{stat.label}</span>
                                    <span className="font-bold">{stat.count}</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                                    <div className={`${stat.color} h-2 rounded-full`} style={{ width: `${(stat.count / Math.max(metrics.totalUsers, 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="p-4 border border-dashed border-slate-300 rounded text-slate-500 hover:border-camel-500 hover:text-camel-600 bg-white">
                           Download User Report (CSV)
                        </button>
                         <button className="p-4 border border-dashed border-slate-300 rounded text-slate-500 hover:border-camel-500 hover:text-camel-600 bg-white">
                           System Health Check
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'FINANCE' && (
         <div className="space-y-6">
             <div className="bg-navy-900 rounded-lg p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center">
                 <div>
                     <p className="text-slate-300 uppercase tracking-wide text-sm font-semibold">Available for Payout</p>
                     <p className="text-4xl font-bold mt-2">${metrics.availableBalance.toFixed(2)}</p>
                     <p className="text-sm text-slate-400 mt-1">Total Lifetime Revenue: ${metrics.totalRevenue.toFixed(2)}</p>
                 </div>
                 <button 
                    onClick={() => setShowPayoutModal(true)}
                    disabled={metrics.availableBalance <= 0}
                    className={`mt-6 md:mt-0 px-6 py-3 rounded font-bold text-navy-900 transition-colors ${metrics.availableBalance > 0 ? 'bg-camel-500 hover:bg-camel-400' : 'bg-slate-500 cursor-not-allowed'}`}
                 >
                     Request Payout
                 </button>
             </div>

             <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Payout History</h3>
                </div>
                <ul className="divide-y divide-gray-200">
                    {payouts.length === 0 && <li className="px-4 py-4 text-center text-gray-500">No payouts yet.</li>}
                    {payouts.slice().reverse().map((payout) => (
                        <li key={payout.id} className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-camel-600 truncate">
                                    {payout.method === 'PAYPAL' ? 'PayPal' : 'Bank Transfer'} to {payout.destination}
                                </p>
                                <div className="ml-2 flex-shrink-0 flex">
                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        {payout.status}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                                <div className="sm:flex">
                                    <p className="flex items-center text-sm text-gray-500">
                                        Amount: <span className="font-bold text-gray-900 ml-1">-${payout.amount.toFixed(2)}</span>
                                    </p>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                    <p>
                                        Processed on {new Date(payout.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
             </div>
         </div>
      )}

      {activeTab === 'USERS' && (
        <div className="bg-white shadow overflow-hidden border-b border-gray-200 sm:rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                 const spent = user.transactions ? user.transactions.reduce((acc, t) => acc + (t.status === 'SUCCESS' ? t.amount : 0), 0) : 0;
                 return (
                <tr key={user.id} className={!user.isActive ? 'bg-gray-50 opacity-75' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                             {user.name}
                             {user.role === 'ADMIN' && <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">Admin</span>}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.role === 'ADMIN' ? (
                        <span className="font-bold text-camel-600">Unlimited</span>
                    ) : (
                        editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    className="w-16 border rounded px-1 bg-white text-slate-900" 
                                    value={editCredits} 
                                    onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                                />
                                <button onClick={saveCredits} className="text-green-600 font-bold">✓</button>
                                <button onClick={() => setEditingUserId(null)} className="text-red-600 font-bold">✕</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {user.credits}
                                <button onClick={() => startEditCredits(user)} className="text-slate-400 hover:text-navy-600" title="Edit Credits">✎</button>
                            </div>
                        )
                    )}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${spent.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.role !== 'ADMIN' && (
                        <button 
                            onClick={() => handleDeactivate(user.id, user.isActive)}
                            className={`${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'TICKETS' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
              {['ALL', 'NEW', 'RESOLVED'].map(filter => (
                  <button 
                    key={filter}
                    onClick={() => setTicketFilter(filter as any)}
                    className={`px-3 py-1 text-xs font-bold rounded ${ticketFilter === filter ? 'bg-navy-800 text-white' : 'bg-white border border-slate-300 text-slate-600'}`}
                  >
                      {filter}
                  </button>
              ))}
          </div>

          {tickets.filter(t => ticketFilter === 'ALL' || (ticketFilter === 'NEW' ? t.status === 'NEW' : t.status !== 'NEW')).length === 0 && <p className="text-center text-slate-500 py-10">No matching tickets found.</p>}
          
          {tickets.filter(t => ticketFilter === 'ALL' || (ticketFilter === 'NEW' ? t.status === 'NEW' : t.status !== 'NEW')).map((ticket) => (
            <div key={ticket.id} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h4 className="text-lg font-bold text-navy-900">{ticket.firstName} {ticket.lastName}</h4>
                   <p className="text-sm text-slate-500">{ticket.email} • {ticket.tier} • {new Date(ticket.timestamp).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded ${ticket.status === 'NEW' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {ticket.status}
                </span>
              </div>
              <p className="text-slate-700 bg-slate-50 p-3 rounded mb-4">{ticket.message}</p>
              
              {ticket.adminReplies.length > 0 && (
                <div className="ml-8 border-l-2 border-camel-500 pl-4 mb-4 space-y-2">
                  {ticket.adminReplies.map((reply, idx) => (
                      <div key={idx}>
                          <p className="text-xs text-camel-600 font-bold mb-1">Admin Reply</p>
                          <p className="text-sm text-slate-600">{reply}</p>
                      </div>
                  ))}
                </div>
              )}

              {selectedTicketId === ticket.id ? (
                <div className="mt-4">
                  <textarea
                    className="w-full border border-slate-300 rounded p-2 text-sm mb-2 bg-white text-slate-900"
                    rows={3}
                    placeholder="Type reply here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  ></textarea>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleReply(ticket.id)}
                      className="bg-navy-800 text-white px-3 py-1 rounded text-sm hover:bg-navy-900"
                    >
                      Send Reply
                    </button>
                    <button 
                      onClick={() => setSelectedTicketId(null)}
                      className="bg-white border border-slate-300 text-slate-600 px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="text-camel-600 text-sm font-medium hover:underline"
                >
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPayoutModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handlePayoutSubmit} className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Request Payout
                    </h3>
                    <div className="mt-2 space-y-4">
                        <p className="text-sm text-gray-500">
                            Transfer available funds to your external account.
                        </p>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                            <input 
                                type="number" 
                                required
                                max={metrics.availableBalance}
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                                placeholder={`Max: ${metrics.availableBalance.toFixed(2)}`}
                                value={payoutAmount}
                                onChange={(e) => setPayoutAmount(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Method</label>
                            <select 
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                                value={payoutMethod}
                                onChange={(e) => setPayoutMethod(e.target.value as any)}
                            >
                                <option value="PAYPAL">PayPal</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                {payoutMethod === 'PAYPAL' ? 'PayPal Email' : 'Account Number / IBAN'}
                            </label>
                            <input 
                                type="text" 
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-camel-500 focus:border-camel-500 sm:text-sm bg-white text-slate-900"
                                placeholder={payoutMethod === 'PAYPAL' ? 'email@example.com' : 'XXXX-XXXX-XXXX'}
                                value={payoutDestination}
                                onChange={(e) => setPayoutDestination(e.target.value)}
                            />
                        </div>
                    </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-camel-600 text-base font-medium text-white hover:bg-camel-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-camel-500 sm:ml-3 sm:w-auto sm:text-sm">
                    Process Payout
                    </button>
                    <button type="button" onClick={() => setShowPayoutModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-camel-500 sm:mt-0 sm:w-auto sm:text-sm">
                    Cancel
                    </button>
                </div>
                </form>
            </div>
            </div>
        </div>
      )}
    </div>
  );
};