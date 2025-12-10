import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import SubmitLead from './SubmitLead';
import { AlertTriangle } from 'lucide-react';

interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  campaign: { name: string; formTemplateId?: string };
  agent?: { fullName: string; id: string };
  team?: { name: string; id: string };
  qcAgent?: { id: string; fullName: string };
  bedrooms: number;
  bathrooms: number;
  marketValue: number;
  askingPrice?: number;
  listingStatus: string;
  occupancy: string;
  mortgageYesNo: boolean;
  mortgageAmount?: number;
  closingTimeline: string;
  addressText: string;
  motivationRating: number;
  conditionRating: number;
  additionalInfo?: string;
  customFields?: Record<string, any>;
  qcComment?: string;
  negotiable?: string;
  license?: string;
  propertyType?: string;
  sellingReason?: string;
  ownershipTimelineValue?: number;
  ownershipTimelineUnit?: string;
  isDuplicate?: boolean;
}

const LeadsList: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadTemplate, setSelectedLeadTemplate] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // Empty for today
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'day' | 'month' | 'year'>('day');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  

  const statusColors = {
    Pending: 'bg-yellow-100 text-yellow-800',
    Qualified: 'bg-green-100 text-green-800',
    Disqualified: 'bg-red-100 text-red-800',
    Duplicate: 'bg-cyan-100 text-cyan-800',
    Callback: 'bg-black text-white',
  };

  useEffect(() => {
    loadLeads();
  }, [selectedDate]);

  

  const loadLeads = async () => {
    try {
      setLoading(true);
      
      let url = '/leads';
      const params: string[] = [];
      
      // Add date filter if a specific date is selected
      if (selectedDate) {
        // Parse the selected date (YYYY-MM-DD format)
        const [year, month, day] = selectedDate.split('-').map(Number);
        
        // Create start date at 4:00 AM in local time
        const startDate = new Date(year, month - 1, day, 4, 0, 0, 0);
        
        // Create end date at 4:00 AM next day in local time
        const endDate = new Date(year, month - 1, day + 1, 4, 0, 0, 0);
        
        // Convert to ISO string (UTC) for API
        params.push(`from=${startDate.toISOString()}`);
        params.push(`to=${endDate.toISOString()}`);
        
        console.log('Date filter:', { selectedDate, startDate, endDate });
      } else if (user?.role !== 'Manager') {
        // For non-Manager roles, if no date selected, backend returns today's leads by default
        // For Manager role, if no date selected, show all leads
      }
      
      // Status filter removed
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      console.log('Loading leads from:', url);
      
      const response = await api.get(url);
      console.log('Leads loaded from API:', response.data.leads);
      
      // Use only real API data - no mock fallback
      const loadedLeads = response.data.leads || [];
      setLeads(loadedLeads);
    } catch (error) {
      console.error('Failed to load leads:', error);
      // NO MOCK DATA - just empty array
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const viewLeadDetails = async (lead: Lead) => {
    console.log('Viewing lead details:', lead);
    setSelectedLead(lead);
    setShowLeadDetails(true);
    
    // Fetch template if lead's campaign uses one
    if (lead.campaign?.formTemplateId) {
      try {
        const response = await api.get(`/form-templates/${lead.campaign.formTemplateId}`);
        setSelectedLeadTemplate(response.data);
      } catch (error) {
        console.error('Failed to load form template:', error);
        setSelectedLeadTemplate(null);
      }
    } else {
      setSelectedLeadTemplate(null);
    }
  };

  const returnToPending = async (leadId: string) => {
    const isQC = user?.role === 'QualityControl';
    const confirmMessage = isQC 
      ? 'Are you sure you want to send this lead back to Pending for re-review?'
      : 'Are you sure you want to return this lead to QC as Pending?';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const comment = isQC 
        ? 'Sent back to Pending by QC for re-review'
        : 'Returned to QC by Team Leader';
      
      await api.patch(`/leads/${leadId}/status`, {
        status: 'Pending',
        comment
      });
      
      // Reload leads
      await loadLeads();
      
      const successMessage = isQC
        ? 'Lead sent back to Pending successfully'
        : 'Lead returned to QC successfully';
      showToast(successMessage, 'success');
    } catch (error: any) {
      console.error('Failed to return lead to pending:', error);
      showToast(error.response?.data?.error || 'Failed to update lead status', 'error');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatListingStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'ListedByOwner': 'Listed by Owner',
      'ListedByRealtor': 'Listed by Realtor',
      'NotListed': 'Not Listed'
    };
    return statusMap[status] || status;
  };

  const formatOccupancy = (occupancy: string) => {
    const occupancyMap: { [key: string]: string } = {
      'OwnerOccupied': 'Owner Occupied',
      'RentedMTM': 'Rented Month-to-Month',
      'RentedAnnually': 'Rented Annually',
      'Vacant': 'Vacant'
    };
    return occupancyMap[occupancy] || occupancy;
  };

  const formatTimeline = (timeline: string) => {
    const timelineMap: { [key: string]: string } = {
      'Asap': 'ASAP',
      'Anytime': 'Anytime',
      'ThirtyDays': '30 Days',
      'SixtyDays': '60 Days',
      'NinetyDays': '90 Days',
      'SixMonths': '6 Months'
    };
    return timelineMap[timeline] || timeline;
  };

  const getDisplayDate = () => {
    if (!selectedDate) {
      return 'Today';
    } else {
      const date = new Date(selectedDate);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  const handleTodayClick = () => {
    setSelectedDate('');
    setCalendarOpen(false);
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    const today = new Date();
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    if (nextMonth <= today) {
      setCurrentMonth(nextMonth);
    }
  };

  const goToPreviousYear = () => {
    setCurrentYear(currentYear - 1);
  };

  const goToNextYear = () => {
    const today = new Date();
    if (currentYear < today.getFullYear()) {
      setCurrentYear(currentYear + 1);
    }
  };

  const selectMonth = (monthIndex: number) => {
    setCurrentMonth(new Date(currentYear, monthIndex));
    setCalendarView('day');
  };

  const selectYear = (year: number) => {
    setCurrentYear(year);
    setCalendarView('month');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Leads List */}
        <div className="bg-white rounded-xl border border-gray-100" style={{ overflow: 'visible' }}>
          <div className="px-6 py-4 border-b border-neutral-200/50 bg-white/50 relative rounded-t-2xl" style={{ overflow: 'visible' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                {user?.role === 'Agent' ? 'Your Leads' : 'Leads'} - {getDisplayDate()}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral-600">
                  {leads.length} lead{leads.length !== 1 ? 's' : ''}
                </span>
                
                {/* Submit Lead Button - Only for Agent and SeniorAgent */}
                {(user?.role === 'Agent' || user?.role === 'SeniorAgent') && (
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-xl smooth-transition gradient-mint"
                  >
                    Submit Lead
                  </button>
                )}
                
                {/* Date Selector Button */}
                <div className="relative">
                  <button
                    onClick={() => setCalendarOpen(!calendarOpen)}
                    className="flex items-center space-x-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 smooth-transition focus:outline-none focus:ring-2 focus:ring-mint-400"
                  >
                    <svg className="w-4 h-4 text-neutral-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      {selectedDate 
                        ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'Select Date'
                      }
                    </span>
                  </button>
                  {calendarOpen && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl z-[9999]" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <div className="p-4">
                        {/* Quick Today Button */}
                        <div className="mb-4">
                          <button
                            onClick={handleTodayClick}
                            className="w-full text-left px-3 py-2 text-sm text-mint-600 hover:bg-mint-50 rounded-xl font-medium smooth-transition"
                          >
                            Today
                          </button>
                        </div>

                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => {
                              if (calendarView === 'day') goToPreviousMonth();
                              else if (calendarView === 'month') goToPreviousYear();
                              else setCurrentYear(currentYear - 12);
                            }}
                            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => {
                              if (calendarView === 'day') setCalendarView('month');
                              else if (calendarView === 'month') setCalendarView('year');
                            }}
                            className="text-sm font-semibold text-neutral-900 hover:text-mint-600 transition-colors"
                          >
                            {calendarView === 'day' && getMonthName(currentMonth)}
                            {calendarView === 'month' && currentYear}
                            {calendarView === 'year' && `${currentYear - 6} - ${currentYear + 5}`}
                          </button>
                          
                          <button
                            onClick={() => {
                              if (calendarView === 'day') goToNextMonth();
                              else if (calendarView === 'month') goToNextYear();
                              else setCurrentYear(currentYear + 12);
                            }}
                            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>

                        {/* Day View */}
                        {calendarView === 'day' && (
                          <div>
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className="text-center text-xs font-medium text-neutral-500 py-1">
                                  {day}
                                </div>
                              ))}
                            </div>
                            
                            {/* Calendar days */}
                            <div className="grid grid-cols-7 gap-1">
                              {(() => {
                                const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                                const days = [];
                                const today = new Date();
                                
                                // Empty cells for days before month starts
                                for (let i = 0; i < startingDayOfWeek; i++) {
                                  days.push(<div key={`empty-${i}`} className="aspect-square" />);
                                }
                                
                                // Days of the month
                                for (let day = 1; day <= daysInMonth; day++) {
                                  const date = new Date(year, month, day);
                                  // Use local date string to avoid timezone issues
                                  const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const isSelected = selectedDate === dateString;
                                  const isToday = date.toDateString() === today.toDateString();
                                  const isFuture = date > today;
                                  
                                  days.push(
                                    <button
                                      key={day}
                                      onClick={() => !isFuture && handleDateSelect(dateString)}
                                      disabled={isFuture}
                                      className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                                        isFuture 
                                          ? 'text-neutral-300 cursor-not-allowed' 
                                          : isSelected 
                                            ? 'bg-mint-500 text-white font-semibold' 
                                            : isToday 
                                              ? 'bg-mint-100 text-mint-700 font-semibold' 
                                              : 'hover:bg-neutral-100 text-neutral-700'
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  );
                                }
                                
                                return days;
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Month View */}
                        {calendarView === 'month' && (
                          <div className="grid grid-cols-3 gap-2">
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => {
                              const today = new Date();
                              const isFuture = currentYear > today.getFullYear() || 
                                             (currentYear === today.getFullYear() && index > today.getMonth());
                              const isCurrentMonth = currentYear === today.getFullYear() && index === today.getMonth();
                              
                              return (
                                <button
                                  key={month}
                                  onClick={() => !isFuture && selectMonth(index)}
                                  disabled={isFuture}
                                  className={`py-3 text-sm rounded-lg transition-colors ${
                                    isFuture 
                                      ? 'text-neutral-300 cursor-not-allowed' 
                                      : isCurrentMonth 
                                        ? 'bg-mint-100 text-mint-700 font-semibold' 
                                        : 'hover:bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  {month}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Year View */}
                        {calendarView === 'year' && (
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 12 }, (_, i) => currentYear - 6 + i).map(year => {
                              const today = new Date();
                              const isFuture = year > today.getFullYear();
                              const isCurrentYear = year === today.getFullYear();
                              
                              return (
                                <button
                                  key={year}
                                  onClick={() => !isFuture && selectYear(year)}
                                  disabled={isFuture}
                                  className={`py-3 text-sm rounded-lg transition-colors ${
                                    isFuture 
                                      ? 'text-neutral-300 cursor-not-allowed' 
                                      : isCurrentYear 
                                        ? 'bg-mint-100 text-mint-700 font-semibold' 
                                        : 'hover:bg-neutral-100 text-neutral-700'
                                  }`}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={loadLeads}
                  className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl smooth-transition text-sm font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {leads.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-16 w-16 text-neutral-400 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-neutral-600 text-lg font-medium">
                  {selectedDate ? 'No leads found for this day' : 'No leads submitted today yet'}
                </p>
                <p className="text-neutral-500 mt-2">
                  {selectedDate 
                    ? `No leads were submitted on ${new Date(selectedDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}` 
                    : 'Submit your first lead to get started'
                  }
                </p>
                {selectedDate && (
                  <button
                    onClick={handleTodayClick}
                    className="mt-4 px-6 py-3 text-sm font-medium text-white rounded-xl smooth-transition gradient-mint"
                  >
                    View Today
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-b-2xl">
                <table className="min-w-full divide-y divide-neutral-200/50">
                  <thead className="bg-neutral-50/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Campaign
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Owner Details
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Agent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Entry
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200/50">
                    {leads.map((lead) => {
                      // Check if lead was submitted between midnight and 4 AM
                      const leadDate = new Date(lead.createdAt);
                      const leadHour = leadDate.getHours();
                      const isLateNightLead = leadHour >= 0 && leadHour < 4;
                      
                      return (
                      <tr key={lead.id} className={`transition-colors ${
                        isLateNightLead 
                          ? 'bg-neutral-100/70 hover:bg-neutral-150' 
                          : 'hover:bg-neutral-50/50'
                      }`}>
                        {/* Code */}
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                            {lead.serialNumber}
                          </p>
                        </td>

                        {/* Campaign */}
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <p className="text-sm font-medium text-neutral-700">
                            {lead.campaign?.name || 'No Campaign'}
                          </p>
                        </td>

                        {/* Owner Details */}
                        <td className="px-4 py-4 align-middle">
                          <p className="text-sm font-medium text-neutral-900">
                            {lead.homeownerFirst} {lead.homeownerLast}
                          </p>
                          <p className="text-xs text-neutral-600">{lead.email || 'No email'}</p>
                          <p className={`text-xs ${lead.isDuplicate ? 'text-red-600 font-bold' : 'text-neutral-600'}`}>
                            {lead.isDuplicate && (
                              <span title="Duplicate phone number" className="inline-flex align-middle">
                                <AlertTriangle className="w-3 h-3 mr-1 text-red-600" />
                              </span>
                            )}
                            <span>{lead.phone}</span>
                          </p>
                        </td>

                        {/* Agent Name */}
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <p className="text-sm font-medium text-neutral-700">
                            {lead.agent?.fullName || 'N/A'}
                          </p>
                        </td>

                        {/* Entry Time */}
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <p className="text-sm text-neutral-700">
                            {new Date(lead.createdAt).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap align-middle">
                          <span className={`status-badge inline-block px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[lead.status as keyof typeof statusColors]}`}>
                            {lead.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                          <div className="flex justify-center items-center space-x-2">
                            <button 
                              onClick={() => viewLeadDetails(lead)}
                              className="px-3 py-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                            >
                              View
                            </button>
                            {user?.role === 'TeamLeader' && lead.status === 'Callback' && (
                              <button
                                onClick={() => returnToPending(lead.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-mint-500 hover:bg-mint-600 rounded-lg transition-colors"
                              >
                                Return
                              </button>
                            )}
                            {user?.role === 'QualityControl' && ['Qualified', 'Disqualified', 'Duplicate', 'Callback'].includes(lead.status) && (
                              <button
                                onClick={() => returnToPending(lead.id)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
                              >
                                Send Back
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Submit Lead Modal */}
        {showSubmitModal && (
          <SubmitLead 
            isModal={true}
            onClose={() => setShowSubmitModal(false)}
            onSuccess={() => {
              setShowSubmitModal(false);
              loadLeads();
            }} 
          />
        )}

        {/* Lead Details Modal */}
        {showLeadDetails && selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto w-full max-w-5xl bg-white border border-gray-200 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center z-10">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Serial: {selectedLead.serialNumber}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedLead.status === 'Qualified' ? 'bg-green-100 text-green-800' :
                    selectedLead.status === 'Disqualified' ? 'bg-red-100 text-red-800' :
                    selectedLead.status === 'Duplicate' ? 'bg-cyan-100 text-cyan-800' :
                    selectedLead.status === 'Callback' ? 'bg-black text-white' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedLead.status}
                  </span>
                  <button
                    onClick={() => setShowLeadDetails(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Contact Information */}
                    <div className="bg-gray-50 p-5 border-l-4 border-blue-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Phone</span>
                          <span className={`text-sm flex items-center ${selectedLead.isDuplicate ? 'text-red-600 font-bold' : 'text-gray-900 font-medium'}`}>
                            {selectedLead.isDuplicate && (
                              <span title="Duplicate phone number" className="inline-flex">
                                <AlertTriangle className="w-4 h-4 mr-1 text-red-600" />
                              </span>
                            )}
                            {selectedLead.phone}
                          </span>
                        </div>
                        {selectedLead.email && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Email</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Fields - Show if lead has custom fields */}
                    {selectedLead.customFields && Object.keys(selectedLead.customFields).length > 0 && selectedLeadTemplate && (
                      <div className="bg-gray-50 p-5 border-l-4 border-purple-500">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campaign Information</h4>
                        <div className="space-y-2">
                          {Object.entries(selectedLead.customFields).map(([fieldId, value]) => {
                            // Find the field definition from template to get the label
                            const fieldDef = selectedLeadTemplate.fields?.find((f: any) => f.id === fieldId);
                            const label = fieldDef?.label || fieldId;
                            
                            // Skip section headers and separators
                            if (fieldDef?.fieldType === 'section' || fieldDef?.fieldType === 'separator') {
                              return null;
                            }
                            
                            return (
                              <div key={fieldId} className="flex justify-between">
                                <span className="text-sm text-gray-600">{label}</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {Array.isArray(value) ? value.join(', ') : 
                                   typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                                   value?.toString() || 'N/A'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Property Details - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-green-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Details</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Address</span>
                          <span className="text-sm font-medium text-gray-900 text-right">{selectedLead.addressText}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bedrooms</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.bedrooms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bathrooms</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.bathrooms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Market Value</span>
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(selectedLead.marketValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Asking Price</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {selectedLead.askingPrice && selectedLead.askingPrice > 0 ? formatCurrency(selectedLead.askingPrice) : 'No asking price'}
                          </span>
                        </div>
                        {selectedLead.negotiable && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Negotiable</span>
                            <span className={`text-sm font-semibold ${selectedLead.negotiable === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedLead.negotiable}
                            </span>
                          </div>
                        )}
                        {selectedLead.sellingReason && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Selling Reason</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.sellingReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Property Status - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-purple-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Listing Status</span>
                          <span className="text-sm font-medium text-gray-900">{formatListingStatus(selectedLead.listingStatus)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Occupancy</span>
                          <span className="text-sm font-medium text-gray-900">{formatOccupancy(selectedLead.occupancy)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Mortgage</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.mortgageYesNo ? 'Yes' : 'No'}</span>
                        </div>
                        {selectedLead.mortgageYesNo && selectedLead.mortgageAmount && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Mortgage Amount</span>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(selectedLead.mortgageAmount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Property Information - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-orange-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Information</h4>
                      <div className="space-y-2">
                        {selectedLead.license && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">License</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.license}</span>
                          </div>
                        )}
                        {selectedLead.propertyType && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Property Type</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.propertyType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Timeline & Ratings - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-indigo-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline & Ratings</h4>
                      <div className="space-y-2">
                        {selectedLead.ownershipTimelineValue && selectedLead.ownershipTimelineUnit && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Ownership Timeline</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.ownershipTimelineValue} {selectedLead.ownershipTimelineUnit}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Closing Timeline</span>
                          <span className="text-sm font-medium text-gray-900">{formatTimeline(selectedLead.closingTimeline)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Motivation</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedLead.motivationRating}/10</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Condition</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedLead.conditionRating}/10</span>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Campaign & Assignment */}
                    <div className="bg-gray-50 p-5 border-l-4 border-cyan-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campaign & Assignment</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Campaign</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.campaign?.name || 'No Campaign'}</span>
                        </div>
                        {selectedLead.agent && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Agent</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.agent?.fullName || 'Unknown'}</span>
                          </div>
                        )}
                        {selectedLead.team && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Team</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.team?.name || 'No Team'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lead Information */}
                    <div className="bg-gray-50 p-5 border-l-4 border-gray-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lead Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Submitted</span>
                          <span className="text-sm font-medium text-gray-900">{new Date(selectedLead.createdAt).toLocaleString()}</span>
                        </div>
                        {selectedLead.updatedAt && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Last Updated</span>
                            <span className="text-sm font-medium text-gray-900">{new Date(selectedLead.updatedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedLead.qcAgent && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">QC Agent</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.qcAgent.fullName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QC Comment */}
                    {selectedLead.qcComment && (
                      <div className="bg-yellow-50 p-5 border-l-4 border-yellow-500">
                        <h4 className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-2">QC Comment</h4>
                        <p className="text-sm text-yellow-900">{selectedLead.qcComment}</p>
                      </div>
                    )}

                    {/* Additional Information */}
                    {selectedLead.additionalInfo && (
                      <div className="bg-blue-50 p-5 border-l-4 border-blue-500">
                        <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Additional Information</h4>
                        <p className="text-sm text-blue-900">{selectedLead.additionalInfo}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowLeadDetails(false)}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LeadsList;