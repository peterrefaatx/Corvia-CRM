import React from 'react';

interface FormConfig {
  listingStatus: { enabled: boolean; options: string[]; required: boolean };
  occupancy: { enabled: boolean; options: string[]; required: boolean };
  mortgage: { enabled: boolean; required: boolean };
  propertyType: { enabled: boolean; options: string[]; required: boolean };
  license: { enabled: boolean; options: string[]; required: boolean };
  closingTimeline: { enabled: boolean; options: string[]; required: boolean };
}

interface Props {
  formConfig: FormConfig;
  onChange: (config: FormConfig) => void;
}

// Premium Checkbox Component
const PremiumCheckbox: React.FC<{
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  variant?: 'primary' | 'secondary';
}> = ({ checked, onChange, label, variant = 'primary' }) => {
  const colors = variant === 'primary' 
    ? 'peer-checked:bg-cyan-600 peer-checked:border-cyan-600' 
    : 'peer-checked:bg-purple-600 peer-checked:border-purple-600';
  
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <div className={`w-5 h-5 border-2 border-gray-300 rounded transition-all duration-200 ${colors} peer-checked:scale-110 group-hover:border-gray-400 peer-focus:ring-2 peer-focus:ring-cyan-200 peer-focus:ring-offset-1`}>
          {checked && (
            <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{label}</span>
    </label>
  );
};

const CampaignFormConfig: React.FC<Props> = ({ formConfig, onChange }) => {
  const [expandedFields, setExpandedFields] = React.useState<Record<string, boolean>>({});

  const toggleExpanded = (field: string) => {
    setExpandedFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateField = (field: keyof FormConfig, updates: Partial<FormConfig[keyof FormConfig]>) => {
    onChange({
      ...formConfig,
      [field]: { ...formConfig[field], ...updates }
    });
  };

  const toggleOption = (field: 'listingStatus' | 'occupancy' | 'propertyType' | 'license' | 'closingTimeline', option: string) => {
    const currentOptions = formConfig[field].options;
    const newOptions = currentOptions.includes(option)
      ? currentOptions.filter(o => o !== option)
      : [...currentOptions, option];
    
    updateField(field, { options: newOptions });
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Form Field Configuration</h3>
        <p className="text-xs text-gray-600 mb-4">Configure which fields are enabled in the submit lead form for this campaign.</p>

        {/* Listing Status */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('listingStatus')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['listingStatus'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Listing Status</span>
            </div>
          </div>
          {expandedFields['listingStatus'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <PremiumCheckbox
                    checked={formConfig.listingStatus.enabled}
                    onChange={(e) => updateField('listingStatus', { enabled: e.target.checked })}
                    label="Enable Field"
                  />
                  {formConfig.listingStatus.enabled && (
                    <PremiumCheckbox
                      checked={formConfig.listingStatus.required}
                      onChange={(e) => updateField('listingStatus', { required: e.target.checked })}
                      label="Required"
                      variant="secondary"
                    />
                  )}
                </div>
                {formConfig.listingStatus.enabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    {['ListedByOwner', 'ListedByRealtor', 'NotListed'].map(option => (
                      <PremiumCheckbox
                        key={option}
                        checked={formConfig.listingStatus.options.includes(option)}
                        onChange={() => toggleOption('listingStatus', option)}
                        label={option.replace(/([A-Z])/g, ' $1').trim()}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Occupancy */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('occupancy')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['occupancy'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Occupancy</span>
            </div>
          </div>
          {expandedFields['occupancy'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <PremiumCheckbox
                    checked={formConfig.occupancy.enabled}
                    onChange={(e) => updateField('occupancy', { enabled: e.target.checked })}
                    label="Enable Field"
                  />
                  {formConfig.occupancy.enabled && (
                    <PremiumCheckbox
                      checked={formConfig.occupancy.required}
                      onChange={(e) => updateField('occupancy', { required: e.target.checked })}
                      label="Required"
                      variant="secondary"
                    />
                  )}
                </div>
                {formConfig.occupancy.enabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    {['OwnerOccupied', 'RentedMTM', 'RentedAnnually', 'Vacant'].map(option => (
                      <PremiumCheckbox
                        key={option}
                        checked={formConfig.occupancy.options.includes(option)}
                        onChange={() => toggleOption('occupancy', option)}
                        label={option.replace(/([A-Z])/g, ' $1').trim()}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mortgage */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('mortgage')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['mortgage'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Mortgage Information</span>
            </div>
          </div>
          {expandedFields['mortgage'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <PremiumCheckbox
                  checked={formConfig.mortgage.enabled}
                  onChange={(e) => updateField('mortgage', { enabled: e.target.checked })}
                  label="Enable Field"
                />
                {formConfig.mortgage.enabled && (
                  <PremiumCheckbox
                    checked={formConfig.mortgage.required}
                    onChange={(e) => updateField('mortgage', { required: e.target.checked })}
                    label="Required"
                    variant="secondary"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Property Type */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('propertyType')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['propertyType'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Property Type</span>
            </div>
          </div>
          {expandedFields['propertyType'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <PremiumCheckbox
                    checked={formConfig.propertyType.enabled}
                    onChange={(e) => updateField('propertyType', { enabled: e.target.checked })}
                    label="Enable Field"
                  />
                  {formConfig.propertyType.enabled && (
                    <PremiumCheckbox
                      checked={formConfig.propertyType.required}
                      onChange={(e) => updateField('propertyType', { required: e.target.checked })}
                      label="Required"
                      variant="secondary"
                    />
                  )}
                </div>
                {formConfig.propertyType.enabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    {[
                      { value: 'SingleFamily', label: 'Single Family House' },
                      { value: 'MultiFamily', label: 'Multi Family House' },
                      { value: 'Condo', label: 'Condo' },
                      { value: 'Townhouse', label: 'Town House' },
                      { value: 'VacantLots', label: 'Vacant Lots' },
                      { value: 'Apartment', label: 'Apartment' },
                      { value: 'MobileHome', label: 'Mobile Home' },
                      { value: 'MobileHomeAndLot', label: 'Mobile Home & Lot' }
                    ].map(({ value, label }) => (
                      <PremiumCheckbox
                        key={value}
                        checked={formConfig.propertyType.options.includes(value)}
                        onChange={() => toggleOption('propertyType', value)}
                        label={label}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* License */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('license')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['license'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">License</span>
            </div>
          </div>
          {expandedFields['license'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <PremiumCheckbox
                    checked={formConfig.license.enabled}
                    onChange={(e) => updateField('license', { enabled: e.target.checked })}
                    label="Enable Field"
                  />
                  {formConfig.license.enabled && (
                    <PremiumCheckbox
                      checked={formConfig.license.required}
                      onChange={(e) => updateField('license', { required: e.target.checked })}
                      label="Required"
                      variant="secondary"
                    />
                  )}
                </div>
                {formConfig.license.enabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    {[
                      { value: 'Residential', label: 'Residential' },
                      { value: 'Commercial', label: 'Commercial' },
                      { value: 'Agriculture', label: 'Agriculture' },
                      { value: 'MixedUse', label: 'Mixed Use' }
                    ].map(({ value, label }) => (
                      <PremiumCheckbox
                        key={value}
                        checked={formConfig.license.options.includes(value)}
                        onChange={() => toggleOption('license', value)}
                        label={label}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Closing Timeline */}
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 cursor-pointer"
            onClick={() => toggleExpanded('closingTimeline')}
          >
            <div className="flex items-center gap-3">
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedFields['closingTimeline'] ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">Closing Timeline</span>
            </div>
          </div>
          {expandedFields['closingTimeline'] && (
            <div className="p-6 pt-5 bg-gray-50 border-t border-gray-200">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <PremiumCheckbox
                    checked={formConfig.closingTimeline.enabled}
                    onChange={(e) => updateField('closingTimeline', { enabled: e.target.checked })}
                    label="Enable Field"
                  />
                  {formConfig.closingTimeline.enabled && (
                    <PremiumCheckbox
                      checked={formConfig.closingTimeline.required}
                      onChange={(e) => updateField('closingTimeline', { required: e.target.checked })}
                      label="Required"
                      variant="secondary"
                    />
                  )}
                </div>
                {formConfig.closingTimeline.enabled && (
                  <div className="ml-6 space-y-2 pt-2">
                    {[
                      { value: 'Asap', label: 'ASAP' },
                      { value: 'ThirtyDays', label: '30 Days' },
                      { value: 'SixtyDays', label: '60 Days' },
                      { value: 'NinetyDays', label: '90 Days' },
                      { value: 'SixMonths', label: '6 Months' }
                    ].map(({ value, label }) => (
                      <PremiumCheckbox
                        key={value}
                        checked={formConfig.closingTimeline.options.includes(value)}
                        onChange={() => toggleOption('closingTimeline', value)}
                        label={label}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignFormConfig;
