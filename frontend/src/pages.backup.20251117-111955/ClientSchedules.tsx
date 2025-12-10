import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface ClientSchedule {
  id: string;
  leadId: string;
  scheduledDate: string;
  type: 'CALL' | 'APPOINTMENT';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'MISSED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lead: {
    serialNumber: string;
    homeownerFirst: string;
    homeownerLast: string;
    phone: string;
    addressText: string;
    pipelineStage: string;
  };
}

const ClientSchedules: React.FC = () => {
  const { showToast } = useToast();
  const [schedules, setSchedules] = useState<ClientSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active'); // 'active' = scheduled + rescheduled
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDaySchedules, setSelectedDaySchedules] = useState<ClientSchedule[] | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      const response = await api.get('/client/schedules');
      setSchedules(response.data);
    } catch (error) {
      showToast('Failed to load schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleStatus = async (scheduleId: string, status: ClientSchedule['status']) => {
    try {
      await api.patch(`/client/schedules/${scheduleId}`, { status });
      await loadSchedules();
      showToast('Schedule updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update schedule', 'error');
    }
  };

  const startReschedule = (schedule: ClientSchedule) => {
    setReschedulingId(schedule.id);
    const date = new Date(schedule.scheduledDate);
    setRescheduleDate(date.toISOString().split('T')[0]);
    setRescheduleTime(date.toTimeString().slice(0, 5));
  };

  const confirmReschedule = async (scheduleId: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      showToast('Please select date and time', 'error');
      return;
    }

    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
      await api.patch(`/client/schedules/${scheduleId}`, {
        scheduledDate: newDateTime.toISOString(),
        status: 'RESCHEDULED'
      });
      
      setReschedulingId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      await loadSchedules();
      showToast('Schedule rescheduled successfully', 'success');
    } catch (error) {
      showToast('Failed to reschedule', 'error');
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      await api.delete(`/client/schedules/${scheduleId}`);
      await loadSchedules();
      showToast('Schedule deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete schedule', 'error');
    }
  };

  // Add "MISSED" status for past scheduled items
  const schedulesWithMissed = schedules.map(schedule => {
    const now = new Date();
    const scheduleDate = new Date(schedule.scheduledDate);
    
    // If it's scheduled or rescheduled but the time has passed, mark as MISSED
    if ((schedule.status === 'SCHEDULED' || schedule.status === 'RESCHEDULED') && scheduleDate < now) {
      return { ...schedule, status: 'MISSED' as ClientSchedule['status'] };
    }
    return schedule;
  });

  const filteredSchedules = schedulesWithMissed.filter(schedule => {
    // Type filter
    if (typeFilter !== 'all' && schedule.type !== typeFilter) return false;
    
    // Status filter
    if (statusFilter === 'active') {
      // Show SCHEDULED, RESCHEDULED, and MISSED
      return schedule.status === 'SCHEDULED' || schedule.status === 'RESCHEDULED' || schedule.status === 'MISSED';
    } else if (statusFilter !== 'all') {
      return schedule.status === statusFilter;
    }
    
    return true;
  });

  const upcomingSchedules = filteredSchedules.filter(s => 
    (s.status === 'SCHEDULED' || s.status === 'RESCHEDULED') && new Date(s.scheduledDate) >= new Date()
  );

  const missedSchedules = filteredSchedules.filter(s => s.status === 'MISSED');

  const todaySchedules = upcomingSchedules.filter(s => {
    const scheduleDate = new Date(s.scheduledDate);
    const today = new Date();
    return scheduleDate.toDateString() === today.toDateString();
  });

  // Generate month calendar
  const getMonthCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the Sunday before the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End on the Saturday after the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const getSchedulesForDay = (date: Date) => {
    // Include upcoming schedules and missed schedules for the day
    return filteredSchedules.filter(schedule => {
      if (schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED') return false;
      const scheduleDate = new Date(schedule.scheduledDate);
      return scheduleDate.toDateString() === date.toDateString();
    }).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  };

  const calendarDays = getMonthCalendarDays();
  
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                My Schedules
              </h1>
              <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                Manage your calls and appointments
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 py-2 text-sm transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm transition-all border-l border-slate-200 ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  List
                </button>
              </div>

              {/* Month Navigation (Calendar View Only) */}
              {viewMode === 'calendar' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousMonth}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    ←
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    Today
                  </button>
                  <span className="px-4 py-2 text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={goToNextMonth}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    →
                  </button>
                </div>
              )}

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
              >
                <option value="all">All Types</option>
                <option value="CALL">Calls Only</option>
                <option value="APPOINTMENT">Appointments Only</option>
              </select>

              {/* Status Filter (List View Only) */}
              {viewMode === 'list' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  <option value="active">Active (Scheduled & Rescheduled)</option>
                  <option value="MISSED">Missed</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="all">All Status</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Alerts */}
          <div className="mb-6 space-y-3">
            {/* Missed Schedules Alert */}
            {missedSchedules.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h2 className="text-lg text-red-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                  ⚠️ Missed Schedules
                </h2>
                <p className="text-sm text-red-700" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                  You have {missedSchedules.length} missed {missedSchedules.length === 1 ? 'schedule' : 'schedules'}. Please mark them as completed or reschedule.
                </p>
              </div>
            )}

            {/* Today's Schedules Banner */}
            {todaySchedules.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h2 className="text-lg text-indigo-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                  📅 Today's Schedule
                </h2>
                <p className="text-sm text-indigo-700" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                  You have {todaySchedules.length} {todaySchedules.length === 1 ? 'item' : 'items'} scheduled for today
                </p>
              </div>
            )}
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="bg-slate-50 border-b border-r border-slate-200 px-2 py-3 text-center last:border-r-0"
                  >
                    <span className="text-xs text-slate-600 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      {day}
                    </span>
                  </div>
                ))}

                {/* Calendar Days */}
                {calendarDays.map((day, index) => {
                  const daySchedules = getSchedulesForDay(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[120px] border-b border-r border-slate-200 p-2 last:border-r-0 ${
                        index >= calendarDays.length - 7 ? 'border-b-0' : ''
                      } ${
                        isToday ? 'bg-indigo-50' : isCurrentMonth ? 'bg-white' : 'bg-slate-50'
                      } hover:bg-slate-50 transition-colors cursor-pointer`}
                      onClick={() => daySchedules.length > 0 && setSelectedDaySchedules(daySchedules)}
                    >
                      {/* Day Number */}
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm ${
                          isToday 
                            ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center' 
                            : isCurrentMonth 
                              ? 'text-slate-900' 
                              : 'text-slate-400'
                        }`} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: isToday ? 600 : 500 }}>
                          {day.getDate()}
                        </span>
                        {daySchedules.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {daySchedules.length}
                          </span>
                        )}
                      </div>

                      {/* Schedules */}
                      <div className="space-y-1">
                        {daySchedules.slice(0, 3).map((schedule) => (
                          <div
                            key={schedule.id}
                            className={`text-xs px-2 py-1 rounded truncate ${
                              schedule.status === 'MISSED' 
                                ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                : schedule.status === 'RESCHEDULED'
                                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            title={`${new Date(schedule.scheduledDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - ${schedule.lead.homeownerFirst} ${schedule.lead.homeownerLast}`}
                          >
                            {schedule.type === 'CALL' ? '📞' : '📅'} {new Date(schedule.scheduledDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </div>
                        ))}
                        {daySchedules.length > 3 && (
                          <div className="text-xs text-slate-500 px-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                            +{daySchedules.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day Details Modal */}
          {selectedDaySchedules && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDaySchedules(null)}>
              <div className="bg-white max-w-2xl w-full max-h-[80vh] overflow-hidden rounded-xl border border-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    {selectedDaySchedules[0] && new Date(selectedDaySchedules[0].scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setSelectedDaySchedules(null)}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                  <div className="space-y-3">
                    {selectedDaySchedules.map((schedule) => (
                      <div key={schedule.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                                {new Date(schedule.scheduledDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-sm text-slate-700" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                {schedule.type === 'CALL' ? '📞 Call' : '📅 Appointment'}
                              </span>
                              {schedule.status === 'RESCHEDULED' && (
                                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                  Rescheduled
                                </span>
                              )}
                              {schedule.status === 'MISSED' && (
                                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                  Missed
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                              {schedule.lead.homeownerFirst} {schedule.lead.homeownerLast}
                            </div>
                            <div className="text-xs text-slate-600 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                              📱 {schedule.lead.phone}
                            </div>
                            {schedule.notes && (
                              <div className="mt-2 text-xs text-slate-600 italic" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                                "{schedule.notes}"
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              deleteSchedule(schedule.id);
                              setSelectedDaySchedules(selectedDaySchedules.filter(s => s.id !== schedule.id));
                              if (selectedDaySchedules.length === 1) setSelectedDaySchedules(null);
                            }}
                            className="text-slate-400 hover:text-red-600 transition-colors text-lg leading-none ml-2"
                          >
                            ×
                          </button>
                        </div>

                        {/* Actions */}
                        {reschedulingId === schedule.id ? (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              />
                              <input
                                type="time"
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  confirmReschedule(schedule.id);
                                  setSelectedDaySchedules(null);
                                }}
                                className="flex-1 px-2 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setReschedulingId(null);
                                  setRescheduleDate('');
                                  setRescheduleTime('');
                                }}
                                className="flex-1 px-2 py-1.5 bg-white text-slate-700 text-xs rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                            <button
                              onClick={() => {
                                updateScheduleStatus(schedule.id, 'COMPLETED');
                                setSelectedDaySchedules(null);
                              }}
                              className="flex-1 px-2 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => startReschedule(schedule)}
                              className="flex-1 px-2 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Reschedule
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSchedules.length > 0 ? (
              filteredSchedules.map((schedule) => {
                const isToday = new Date(schedule.scheduledDate).toDateString() === new Date().toDateString();
                const isPast = new Date(schedule.scheduledDate) < new Date();
                
                return (
                  <div 
                    key={schedule.id} 
                    className={`bg-white rounded-lg p-5 border ${
                      isToday && schedule.status === 'SCHEDULED' 
                        ? 'border-indigo-300 shadow-md' 
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {schedule.type === 'CALL' ? '📞 Call' : '📅 Appointment'}
                          </span>
                          <span className={`text-xs px-2.5 py-1 rounded-full ${
                            schedule.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                            schedule.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            schedule.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            schedule.status === 'MISSED' ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                            {schedule.status}
                          </span>
                        </div>
                        {isToday && schedule.status === 'SCHEDULED' && (
                          <span className="inline-block text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                            Today
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors text-xl leading-none"
                      >
                        ×
                      </button>
                    </div>

                    {/* Lead Info */}
                    <div className="mb-4 pb-4 border-b border-slate-100">
                      <div className="text-sm text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                        {schedule.lead.homeownerFirst} {schedule.lead.homeownerLast}
                      </div>
                      <div className="text-xs text-slate-600 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                        {schedule.lead.addressText}
                      </div>
                      <div className="text-xs text-slate-700" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                        📱 {schedule.lead.phone}
                      </div>
                      <div className="text-xs text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                        Stage: {schedule.lead.pipelineStage}
                      </div>
                    </div>

                    {/* Schedule Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Date:</label>
                        <span className={`text-sm ${isPast && schedule.status === 'SCHEDULED' ? 'text-red-600' : 'text-slate-900'}`} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                          {new Date(schedule.scheduledDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Time:</label>
                        <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                          {new Date(schedule.scheduledDate).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {schedule.notes && (
                      <div className="mb-4 pb-4 border-b border-slate-100">
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Notes</label>
                        <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                          {schedule.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {(schedule.status === 'SCHEDULED' || schedule.status === 'MISSED') && (
                      <>
                        {reschedulingId === schedule.id ? (
                          <div>
                            <label className="block text-xs text-slate-500 uppercase tracking-wide mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Reschedule To</label>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <input
                                type="date"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              />
                              <input
                                type="time"
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => confirmReschedule(schedule.id)}
                                className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setReschedulingId(null);
                                  setRescheduleDate('');
                                  setRescheduleTime('');
                                }}
                                className="flex-1 px-3 py-2 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateScheduleStatus(schedule.id, 'COMPLETED')}
                              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => startReschedule(schedule)}
                              className="flex-1 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Reschedule
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-500 text-sm" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                  No schedules found
                </p>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientSchedules;
