import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface AgentStats {
  id: string;
  fullName: string;
  team: { name: string };
  total: number;
  qualified: number;
  disqualified: number;
  duplicate: number;
  pending: number;
  callback: number;
  score: number;
}

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboardData();
  }, []);

  const loadLeaderboardData = async () => {
    try {
      setLoading(true);
      
      // Load real data from API
      const agentsResponse = await api.get('/leaderboard/agents');
      
      // Calculate score (qualified - disqualified) for each agent
      const agentsWithScore = (agentsResponse.data || []).map((agent: any) => ({
        ...agent,
        score: agent.qualified - agent.disqualified
      }));
      
      // Get top 10 agents and pad with empty slots if needed
      const topAgents = agentsWithScore.slice(0, 10);
      
      // Pad with empty slots to always show 10 rows
      while (topAgents.length < 10) {
        topAgents.push({
          id: `empty-${topAgents.length}`,
          fullName: '-',
          team: { name: '-' },
          total: 0,
          qualified: 0,
          disqualified: 0,
          duplicate: 0,
          pending: 0,
          callback: 0,
          score: 0
        });
      }
      
      setAgents(topAgents);
      
    } catch (error) {
      console.error('Failed to load leaderboard data:', error);
      // Create 10 empty slots
      const emptySlots = Array.from({ length: 10 }, (_, i) => ({
        id: `empty-${i}`,
        fullName: '-',
        team: { name: '-' },
        total: 0,
        qualified: 0,
        disqualified: 0,
        duplicate: 0,
        pending: 0,
        callback: 0,
        score: 0
      }));
      setAgents(emptySlots);
    } finally {
      setLoading(false);
    }
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
        {/* Leaderboard Content */}
        <div className="glass border border-neutral-200/30 overflow-hidden">
          {/* Title Header */}
          <div className="px-6 py-4 bg-white/50 border-b border-neutral-200/50">
            <h2 className="text-lg font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
              Top Agents
            </h2>
          </div>
          
          <table className="min-w-full">
            <thead className="bg-white/50">
              <tr>
                <th className="pl-6 pr-2 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '80px' }}>
                  <div className="text-center">Rank</div>
                </th>
                <th className="px-2 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '80px' }}>
                  <div className="text-center">Score</div>
                </th>
                <th className="px-3 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '600px' }}>
                  <div className="text-center">Agent</div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Pending</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Callback</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Qualified</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Disqualified</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Duplicate</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '120px' }}>Total</th>
              </tr>
            </thead>
            <tbody className="bg-white/30">
              {agents.map((agent, index) => {
                const isCurrentUser = user?.id === agent.id;
                const isEmpty = agent.fullName === '-';
                return (
                  <tr key={agent.id} className={isCurrentUser ? 'bg-emerald-50' : ''}>
                    <td className="pl-6 pr-2 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {isEmpty ? '' : index + 1}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm font-bold text-center text-neutral-900">
                      {isEmpty ? '' : agent.score}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-center text-neutral-900">
                      {isEmpty ? '' : agent.fullName}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-yellow-600">
                      {isEmpty ? '' : agent.pending}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-gray-600">
                      {isEmpty ? '' : agent.callback}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-center text-green-600">
                      {isEmpty ? '' : agent.qualified}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-red-600">
                      {isEmpty ? '' : agent.disqualified}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-cyan-600">
                      {isEmpty ? '' : agent.duplicate}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-neutral-900">
                      {isEmpty ? '' : agent.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default Leaderboard;