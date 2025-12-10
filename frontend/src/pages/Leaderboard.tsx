import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

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
  usePageTitle('Top Agents');
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
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Leaderboard Content */}
        <div className="glass border border-neutral-200/30 overflow-hidden" style={{ width: '90%', margin: '0 auto' }}>
          {/* Title Header */}
          <div className="px-6 py-4 bg-white/50 border-t-4 border-t-gray-800 border-b border-neutral-200/50">
            <h2 className="text-lg font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
              Top Agents
            </h2>
          </div>
          
          <table className="min-w-full" style={{ paddingBottom: '16px' }}>
            <thead className="bg-white/50">
              <tr>
                <th className="pl-6 pr-2 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '80px' }}>
                  <div className="text-center">#</div>
                </th>
                <th className="px-2 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '80px' }}>
                  <div className="text-center">Score</div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '800px' }}>
                  Agent
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>pend</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>call</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>qual</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>disq</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>dupl</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em', width: '41px' }}>totl</th>
              </tr>
            </thead>
            <tbody className="bg-white/30">
              {agents.map((agent, index) => {
                const isCurrentUser = user?.id === agent.id;
                const isEmpty = agent.fullName === '-';
                const nextAgent = agents[index + 1];
                const nextIsEmpty = nextAgent ? nextAgent.fullName === '-' : true;
                const showBorder = !isEmpty && !nextIsEmpty;
                return (
                  <tr key={agent.id} className={`${isCurrentUser ? 'bg-primary-light' : ''} ${showBorder ? 'border-b border-gray-200' : ''}`} style={{ height: '40px' }}>
                    <td className="pl-6 pr-2 py-2 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {isEmpty ? '' : index + 1}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm text-center text-green-600">
                      {isEmpty ? '' : agent.score}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-neutral-900" style={{ textAlign: 'left' }}>
                      {isEmpty ? '' : agent.fullName}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-gray-900">
                      {isEmpty ? '' : agent.pending}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-gray-600">
                      {isEmpty ? '' : agent.callback}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-green-600">
                      {isEmpty ? '' : agent.qualified}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-red-600">
                      {isEmpty ? '' : agent.disqualified}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-cyan-600">
                      {isEmpty ? '' : agent.duplicate}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-center text-neutral-900">
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




