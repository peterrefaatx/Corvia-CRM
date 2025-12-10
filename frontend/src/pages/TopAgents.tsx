import React from 'react';
import Layout from '../components/Layout/Layout';

const TopAgents: React.FC = () => {
  const agents = [
    { rank: 1, name: 'Agent 1', team: 'Alpha Team', submitted: 45, qualified: 32, disqualified: 8, duplicate: 5, qualifiedPercent: 71 },
    { rank: 2, name: 'Agent 2', team: 'Beta Team', submitted: 38, qualified: 28, disqualified: 6, duplicate: 4, qualifiedPercent: 74 },
    { rank: 3, name: 'Agent 3', team: 'Gamma Team', submitted: 42, qualified: 25, disqualified: 12, duplicate: 5, qualifiedPercent: 60 },
  ];

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Top Agents Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Performance metrics for all agents across teams
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date Range</label>
              <select className="mt-1 block w-full rounded-md border-gray-300 focus:border-cyan-500 focus:ring-cyan-500">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Campaign</label>
              <select className="mt-1 block w-full rounded-md border-gray-300 focus:border-cyan-500 focus:ring-cyan-500">
                <option>All Campaigns</option>
                <option>Spring 2024</option>
                <option>Summer Push</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Team</label>
              <select className="mt-1 block w-full rounded-md border-gray-300 focus:border-cyan-500 focus:ring-cyan-500">
                <option>All Teams</option>
                <option>Alpha Team</option>
                <option>Beta Team</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700">
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qualified</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disqualified</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duplicate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qualified %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent.rank} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-semibold ${
                        agent.rank === 1 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        agent.rank === 2 ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        'bg-orange-100 text-orange-800 border-orange-200'
                      }`}>
                        {agent.rank}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {agent.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agent.team}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.submitted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {agent.qualified}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                    {agent.disqualified}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-cyan-600">
                    {agent.duplicate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {agent.qualifiedPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default TopAgents;




