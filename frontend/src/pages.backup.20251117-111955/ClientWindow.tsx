import React from 'react';
import Layout from '../components/Layout/Layout';

const ClientWindow: React.FC = () => {
  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Client Window</h1>
        <p className="mt-2 text-gray-600">Read-only view for clients</p>
        <div className="mt-6 bg-white p-6 rounded-lg shadow">
          <p>Client dashboard with qualified leads coming soon...</p>
        </div>
      </div>
    </Layout>
  );
};

export default ClientWindow;