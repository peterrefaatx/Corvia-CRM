import React, { useState } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { Search, AlertCircle, X } from 'lucide-react';

interface DuplicateLead {
  id: string;
  serialNumber: string;
  fullName: string;
  phone: string;
  address: string;
  campaignName: string;
  agentName: string;
  teamName: string;
  status: string;
  sentToClient: boolean;
  createdAt: string;
  matchType: string;
}

const CheckDuplicate: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [results, setResults] = useState<DuplicateLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadDetails, setLeadDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleSearch = async () => {
    if (!name.trim() && !phone.trim() && !address.trim()) {
      setMessage('Please provide at least one search criterion');
      return;
    }

    try {
      setLoading(true);
      setSearched(true);
      const response = await api.post('/duplicate-check/check', {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim()
      });

      setResults(response.data.leads || []);
      setMessage(response.data.message || '');
    } catch (error) {
      console.error('Search error:', error);
      setMessage('Failed to search for duplicates');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setName('');
    setPhone('');
    setAddress('');
    setResults([]);
    setMessage('');
    setSearched(false);
  };

  const handleViewDetails = async (leadId: string) => {
    try {
      setLoadingDetails(true);
      setSelectedLeadId(leadId);
      const response = await api.get(`/leads/${leadId}`);
      setLeadDetails(response.data);
    } catch (error) {
      console.error('Error fetching lead details:', error);
      setLeadDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedLeadId(null);
    setLeadDetails(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Qualified':
        return 'bg-green-100 text-green-800';
      case 'Disqualified':
        return 'bg-red-100 text-red-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Callback':
        return 'bg-blue-100 text-blue-800';
      case 'Duplicate':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Search Form */}
        <div className="glass border border-neutral-200/30 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First & Last Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 transition-colors text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
            >
              Clear
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-4 shadow-sm flex items-center gap-2 ${
              results.length > 0 ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            }`}>
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
        </div>

        {/* Results Table */}
        {searched && (
          <div className="glass border border-neutral-200/30 shadow-sm overflow-hidden">

            {results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white/50">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Serial #</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Full Name</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Phone</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Address</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Campaign</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Agent</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Status</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Sent to Client</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Date</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Actions</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/30">
                    {results.map((lead) => (
                      <tr key={lead.id} className="hover:bg-white/50 transition-colors border-b border-gray-200">
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-cyan-600">
                          {lead.serialNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {lead.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {lead.phone}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-900 max-w-xs truncate">
                          {lead.address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {lead.campaignName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {lead.agentName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`status-badge inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`status-badge inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full ${
                            lead.sentToClient ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {lead.sentToClient ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewDetails(lead.id)}
                            className="inline-flex items-center px-3 py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 text-xs font-medium shadow-sm transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-gray-700 text-lg font-semibold">{loading ? 'Searching...' : 'No matching leads found'}</p>
                {!loading && <p className="text-gray-500 mt-2">Try adjusting your search criteria</p>}
              </div>
            )}
          </div>
        )}

        {/* Lead Details Modal */}
        {selectedLeadId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white shadow-lg border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <h2 className="text-xl font-bold text-gray-900">Lead Details</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                  </div>
                ) : leadDetails ? (
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic I
nformation</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Serial Number</p>
                          <p className="font-medium">{leadDetails.serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Status</p>
                          <span className={`status-badge inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(leadDetails.status)}`}>
                            {leadDetails.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Homeowner Name</p>
                          <p className="font-medium">{leadDetails.homeownerFirst} {leadDetails.homeownerLast}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="font-medium">{leadDetails.phone}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium">{leadDetails.email || 'N/A'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{leadDetails.addressText}</p>
                        </div>
                      </div>
                    </div>

                    {/* Property Details */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Property Details</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Property Type</p>
                          <p className="font-medium">{leadDetails.propertyType || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Bedrooms / Bathrooms</p>
                          <p className="font-medium">{leadDetails.bedrooms} / {leadDetails.bathrooms}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Market Value</p>
                          <p className="font-medium">${leadDetails.marketValue?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Asking Price</p>
                          <p className="font-medium">{leadDetails.askingPrice ? `$${leadDetails.askingPrice.toLocaleString()}` : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Listing Status</p>
                          <p className="font-medium">{leadDetails.listingStatus}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Occupancy</p>
                          <p className="font-medium">{leadDetails.occupancy}</p>
                        </div>
                      </div>
                    </div>

                    {/* Campaign & Agent Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Campaign & Agent</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Campaign</p>
                          <p className="font-medium">{leadDetails.campaign?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Agent</p>
                          <p className="font-medium">{leadDetails.agent?.fullName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Team</p>
                          <p className="font-medium">{leadDetails.team?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Submitted Date</p>
                          <p className="font-medium">{new Date(leadDetails.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    {leadDetails.additionalInfo && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
                        <p className="text-gray-700">{leadDetails.additionalInfo}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    Failed to load lead details
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 shadow-sm">
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CheckDuplicate;
