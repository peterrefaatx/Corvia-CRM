import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { AlertTriangle } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

interface FormConfig {
  listingStatus: { enabled: boolean; options: string[]; required: boolean };
  occupancy: { enabled: boolean; options: string[]; required: boolean };
  mortgage: { enabled: boolean; required: boolean };
  propertyType: { enabled: boolean; options: string[]; required: boolean };
  license: { enabled: boolean; options: string[]; required: boolean };
  closingTimeline: { enabled: boolean; options: string[]; required: boolean };
}

interface Campaign {
  id: string;
  name: string;
  formConfig?: FormConfig;
  formTemplateId?: string;
}

interface CustomField {
  id: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'radio' | 'checkbox' | 'checkboxgroup' | 'date' | 'time' | 'phone' | 'email' | 'currency' | 'rating' | 'section' | 'separator' | 'address';
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
  width: 'full' | 'half' | 'third' | 'quarter';
  ratingMax?: number;
}

interface FormTemplate {
  id: string;
  name: string;
  fields: CustomField[];
}

interface LeadForm {
  campaignId: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email: string;
  marketValue?: number;
  askingPrice?: number;
  negotiable?: 'Yes' | 'No' | '';
  listingStatus?: 'ListedByOwner' | 'ListedByRealtor' | 'NotListed' | '';
  occupancy?: 'OwnerOccupied' | 'RentedMTM' | 'RentedAnnually' | 'Vacant' | '';
  mortgage?: 'Yes' | 'No' | '';
  mortgageAmount?: number;
  propertyType?: 'VacantLots' | 'SingleFamilyHouse' | 'MultiFamilyHouse' | 'Condo' | 'Apartment' | 'TownHouse' | 'MobileHome' | 'MobileHomeAndLot' | '';
  license?: 'Residential' | 'Commercial' | 'Agriculture' | 'MixedUse' | '';
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  utilities?: 'Yes' | 'No' | '';
  addressText: string;
  sellingReason?: 'Downsize' | 'Upgrade' | 'Relocate' | 'TiredOfBeingLandlord' | 'GettingOld' | 'Retirement' | 'InvestingInAnotherProperty' | 'Liquidate' | 'TaxIssues' | 'DontNeedIt' | 'BuyNewProperty' | 'MoneyFactor' | '';
  ownershipTimelineValue?: number;
  ownershipTimelineUnit?: 'months' | 'years' | '';
  closingTimeline?: 'Asap' | 'Anytime' | 'ThirtyDays' | 'SixtyDays' | 'NinetyDays' | 'SixMonths' | '';
  motivationRating: number;
  conditionRating: number;
  additionalInfo?: string;
  submitCheckboxFlag: boolean;
}

interface SubmitLeadProps {
  onSuccess?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

const SubmitLead: React.FC<SubmitLeadProps> = ({ onSuccess, isModal = false, onClose }) => {
  usePageTitle('Submit Lead');
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignConfig, setSelectedCampaignConfig] = useState<FormConfig | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [showMortgageAmount, setShowMortgageAmount] = useState(false);
  const [motivationRating, setMotivationRating] = useState<number>(5);
  const [conditionRating, setConditionRating] = useState<number>(5);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [phoneDuplicate, setPhoneDuplicate] = useState(false);
  const [addressDuplicate, setAddressDuplicate] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<LeadForm>({
    defaultValues: {
      mortgage: '',
      negotiable: '',
      propertyType: '',
      license: '',
      utilities: '',
      sellingReason: '',
      ownershipTimelineUnit: '',
      submitCheckboxFlag: false,
      motivationRating: 5,
      conditionRating: 5,
      bedrooms: 0,
      bathrooms: 0,
      size: 0,
      marketValue: 0,
      askingPrice: 0,
      listingStatus: '',
      occupancy: '',
      closingTimeline: '',
    }
  });

  const campaignId = watch('campaignId');
  const mortgage = watch('mortgage');
  const propertyType = watch('propertyType');
  const submitCheckboxFlag = watch('submitCheckboxFlag');
  const phone = watch('phone');
  const addressText = watch('addressText');
  const isFormDisabled = !campaignId;
  const isVacantLot = propertyType === 'VacantLots';

  useEffect(() => {
    setShowMortgageAmount(mortgage === 'Yes');
  }, [mortgage]);

  useEffect(() => {
    loadCampaigns();
  }, []);

  // Update selected campaign config when campaign changes
  useEffect(() => {
    const loadCampaignForm = async () => {
      if (campaignId) {
        const campaign = campaigns.find(c => c.id === campaignId);
        
        // Check if campaign uses a custom template
        if (campaign?.formTemplateId) {
          try {
            const response = await api.get(`/form-templates/${campaign.formTemplateId}`);
            setSelectedTemplate(response.data);
            setSelectedCampaignConfig(null);
          } catch (error) {
            console.error('Failed to load form template:', error);
            setSelectedTemplate(null);
            setSelectedCampaignConfig(null);
          }
        } else {
          // Use default form config
          setSelectedTemplate(null);
          setSelectedCampaignConfig(campaign?.formConfig || null);
        }
      } else {
        setSelectedCampaignConfig(null);
        setSelectedTemplate(null);
      }
    };

    loadCampaignForm();
  }, [campaignId, campaigns]);

  // Check for duplicates when phone or address changes
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!phone && !addressText) {
        setPhoneDuplicate(false);
        setAddressDuplicate(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (phone) params.append('phone', phone);
        if (addressText) params.append('address', addressText);

        const response = await api.get(`/leads/check-duplicate?${params.toString()}`);
        
        if (response.data.isDuplicate) {
          // Check which field(s) are duplicates
          const phoneMatch = response.data.matches.some((m: any) => m.matchType === 'phone');
          const addressMatch = response.data.matches.some((m: any) => m.matchType === 'address');
          
          setPhoneDuplicate(phoneMatch);
          setAddressDuplicate(addressMatch);
        } else {
          setPhoneDuplicate(false);
          setAddressDuplicate(false);
        }
      } catch (error) {
        console.error('Duplicate check error:', error);
      }
    };

    // Debounce the check
    const timeoutId = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(timeoutId);
  }, [phone, addressText]);

  // Sync local state with form state
  useEffect(() => {
    setValue('motivationRating', motivationRating);
  }, [motivationRating, setValue]);

  useEffect(() => {
    setValue('conditionRating', conditionRating);
  }, [conditionRating, setValue]);

  const loadCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      console.log('Campaigns loaded:', response.data);
      if (response.data.length === 0) {
        console.warn('No campaigns found in database');
      }
      // Parse formConfig from JSON string if it exists
      const campaignsWithConfig = response.data.map((campaign: any) => ({
        ...campaign,
        formConfig: campaign.formConfig ? (typeof campaign.formConfig === 'string' ? JSON.parse(campaign.formConfig) : campaign.formConfig) : null
      }));
      setCampaigns(campaignsWithConfig);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      // Fallback mock data for testing
      setCampaigns([
        { id: '1', name: 'Spring 2024 Campaign' },
        { id: '2', name: 'Summer Push' }
      ]);
    }
  };

  // Parse number from formatted string
  const parseNumber = (value: any): number => {
    if (!value || value === '') return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '');
      return Number(cleaned) || 0;
    }
    return 0;
  };

  const onSubmit = async (data: LeadForm) => {
    if (!submitCheckboxFlag) {
      setSuccessMessage('');
      showWarning('Please confirm that all information is accurate before submitting.');
      return;
    }

    console.log('=== LEAD SUBMISSION START ===');
    console.log('Form data before processing:', data);

    setLoading(true);
    setSuccessMessage('');
    
    try {
      // Prepare the data for API - ensure all values are properly formatted
      const submitData: any = {
        campaignId: data.campaignId,
        homeownerFirst: data.homeownerFirst.trim(),
        homeownerLast: data.homeownerLast.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        submitCheckboxFlag: true
      };

      // If using custom template, only include custom fields
      if (selectedTemplate) {
        // Add custom field values
        if (Object.keys(customFieldValues).length > 0) {
          submitData.customFields = customFieldValues;
        }
        
        // Check if template has an address field and use it
        const addressField = selectedTemplate.fields.find(f => f.fieldType === 'address');
        const addressValue = addressField ? customFieldValues[addressField.id] : null;
        
        // Set dummy values for required real estate fields (backend still expects them)
        submitData.marketValue = 0;
        submitData.addressText = addressValue?.trim() || 'N/A';
        submitData.motivationRating = 5;
        submitData.conditionRating = 5;
        submitData.bedrooms = 0;
        submitData.bathrooms = 0;
        submitData.listingStatus = 'NotListed';
        submitData.occupancy = 'OwnerOccupied';
        submitData.mortgageYesNo = false;
        submitData.closingTimeline = 'Anytime';
      } else {
        // Using default real estate form - validate and include all fields
        
        // Validate required enum fields based on campaign config
        if ((!selectedCampaignConfig || selectedCampaignConfig.listingStatus.enabled) && 
            selectedCampaignConfig?.listingStatus.required !== false && !data.listingStatus) {
          throw new Error('Listing status is required');
        }
        if ((!selectedCampaignConfig || selectedCampaignConfig.occupancy.enabled) && 
            selectedCampaignConfig?.occupancy.required !== false && !data.occupancy) {
          throw new Error('Occupancy status is required');
        }
        if ((!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.enabled) && 
            selectedCampaignConfig?.closingTimeline.required !== false && !data.closingTimeline) {
          throw new Error('Closing timeline is required');
        }

        submitData.marketValue = parseNumber(data.marketValue);
        submitData.addressText = data.addressText.trim();
        submitData.motivationRating = Number(motivationRating);
        submitData.conditionRating = Number(conditionRating);

        // Only include fields if they're enabled in campaign config
        if (!selectedCampaignConfig || selectedCampaignConfig.listingStatus.enabled) {
          submitData.listingStatus = data.listingStatus;
        }
        if (!selectedCampaignConfig || selectedCampaignConfig.occupancy.enabled) {
          submitData.occupancy = data.occupancy;
        }
        if (!selectedCampaignConfig || selectedCampaignConfig.mortgage.enabled) {
          submitData.mortgageYesNo = data.mortgage === 'Yes';
        }
        if (!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.enabled) {
          submitData.closingTimeline = data.closingTimeline;
        }

        // Only include bedrooms/bathrooms if NOT vacant lot
        if (!isVacantLot) {
          submitData.bedrooms = parseNumber(data.bedrooms) || 0;
          submitData.bathrooms = parseNumber(data.bathrooms) || 0;
        } else {
          // For vacant lots, set bedrooms and bathrooms to 0
          submitData.bedrooms = 0;
          submitData.bathrooms = 0;
        }

        // Only include optional fields if they have valid values
        if (parseNumber(data.askingPrice) > 0) {
          submitData.askingPrice = parseNumber(data.askingPrice);
        }
        if (data.negotiable) {
          submitData.negotiable = data.negotiable;
        }
        if (data.mortgage === 'Yes' && data.mortgageAmount) {
          submitData.mortgageAmount = parseNumber(data.mortgageAmount);
        }
        if (data.propertyType) {
          submitData.propertyType = data.propertyType;
        }
        if (data.license) {
          submitData.license = data.license;
        }
        if (isVacantLot) {
          if (parseNumber(data.size) > 0) {
            submitData.size = parseNumber(data.size);
          }
          if (data.utilities) {
            submitData.utilities = data.utilities;
          }
        }
        if (data.sellingReason) {
          submitData.sellingReason = data.sellingReason;
        }
        if (data.ownershipTimelineValue && data.ownershipTimelineValue > 0 && data.ownershipTimelineUnit) {
          submitData.ownershipTimelineValue = parseNumber(data.ownershipTimelineValue);
          submitData.ownershipTimelineUnit = data.ownershipTimelineUnit;
        }
        if (data.additionalInfo && data.additionalInfo.trim()) {
          submitData.additionalInfo = data.additionalInfo.trim();
        }
      }

      console.log('Submitting lead data to backend:', JSON.stringify(submitData, null, 2));

      const response = await api.post('/leads', submitData);
      console.log('Lead submission successful:', response.data);
      
      // Set success message
      const successMsg = `Lead submitted successfully! Serial Number: ${response.data.serialNumber} | Status: ${response.data.status} | Homeowner: ${response.data.homeownerFirst} ${response.data.homeownerLast}`;
      setSuccessMessage(successMsg);
      
      // Reset form
      reset({
        campaignId: '',
        homeownerFirst: '',
        homeownerLast: '',
        phone: '',
        email: '',
        marketValue: 0,
        askingPrice: 0,
        negotiable: '',
        listingStatus: '',
        occupancy: '',
        mortgage: '',
        mortgageAmount: 0,
        propertyType: '',
        license: '',
        bedrooms: 0,
        bathrooms: 0,
        size: 0,
        utilities: '',
        addressText: '',
        sellingReason: '',
        ownershipTimelineValue: 0,
        ownershipTimelineUnit: '',
        closingTimeline: '',
        motivationRating: 5,
        conditionRating: 5,
        additionalInfo: '',
        submitCheckboxFlag: false
      });
      setMotivationRating(5);
      setConditionRating(5);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      console.error('❌ LEAD SUBMISSION FAILED:', error);
      const errorDetails = error.response?.data;
      console.error('Error response details:', errorDetails);
      
      let errorMessage = 'Failed to submit lead. Please try again.';
      
      if (errorDetails?.errors) {
        // Handle validation errors
        errorMessage = errorDetails.errors.map((err: any) => err.msg).join('\n');
      } else if (errorDetails?.error) {
        errorMessage = errorDetails.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSuccessMessage('');
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
      console.log('=== LEAD SUBMISSION END ===');
    }
  };

  const RatingBox: React.FC<{
    type: 'motivation' | 'condition';
    label: string;
    currentValue: number;
  }> = ({ type, label, currentValue }) => {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
            <div className="flex space-x-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleRatingSelect(num, type)}
              disabled={isFormDisabled}
              className={`flex-1 py-2 border transition-colors text-sm font-medium ${
                currentValue === num 
                  ? 'bg-cyan-600 text-white border-cyan-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:border-cyan-500 hover:bg-cyan-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {num}
            </button>
          ))}
        </div>
        <input
          type="hidden"
          {...register(type === 'motivation' ? 'motivationRating' : 'conditionRating', { 
            required: `${label} is required`,
            valueAsNumber: true,
            min: { value: 1, message: 'Rating must be at least 1' },
            max: { value: 10, message: 'Rating must be at most 10' }
          })}
        />
        {errors[type === 'motivation' ? 'motivationRating' : 'conditionRating'] && (
          <p className="mt-1 text-sm text-red-600">
            {errors[type === 'motivation' ? 'motivationRating' : 'conditionRating']?.message}
          </p>
        )}
      </div>
    );
  };

  // Handle rating selection
  const handleRatingSelect = (rating: number, type: 'motivation' | 'condition') => {
    if (type === 'motivation') {
      setMotivationRating(rating);
    } else {
      setConditionRating(rating);
    }
  };

  // Handle number input with formatting
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'marketValue' | 'askingPrice' | 'mortgageAmount') => {
    const value = e.target.value.replace(/\D/g, "");
    const formattedValue = value ? parseInt(value).toLocaleString() : '';
    e.target.value = formattedValue;
    setValue(field, formattedValue as any);
  };

  if (user?.role !== 'Agent' && user?.role !== 'SeniorAgent') {
    const content = (
      <div className="py-6 px-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-medium text-yellow-800">Access Restricted</h2>
          <p className="text-yellow-700 mt-2">
            Only agents can submit leads. Your role is: <strong>{user?.role}</strong>
          </p>
        </div>
      </div>
    );
    
    return isModal ? content : <Layout>{content}</Layout>;
  }

  const formContent = (
    <div className="bg-white shadow-lg border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Submit New Lead</h1>
          <p className="mt-1 text-sm text-gray-600">
            Fill out all required information to submit a new lead for qualification
          </p>
        </div>
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Row 1: Campaign - First Name - Last Name */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Campaign *
                </label>
                <select
                  {...register('campaignId', { required: 'Campaign is required' })}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition"
                >
                  <option value=""></option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
                {errors.campaignId && (
                  <p className="mt-1 text-sm text-red-600">{errors.campaignId.message}</p>
                )}
                {campaigns.length === 0 && (
                  <p className="mt-1 text-sm text-yellow-600">
                    ⚠️ No campaigns found. Please create a campaign first or contact your manager.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  {...register('homeownerFirst', { 
                    required: 'First name is required',
                    minLength: { value: 2, message: 'First name must be at least 2 characters' }
                  })}
                  disabled={isFormDisabled}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.homeownerFirst && (
                  <p className="mt-1 text-sm text-red-600">{errors.homeownerFirst.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  {...register('homeownerLast', { 
                    required: 'Last name is required',
                    minLength: { value: 2, message: 'Last name must be at least 2 characters' }
                  })}
                  disabled={isFormDisabled}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.homeownerLast && (
                  <p className="mt-1 text-sm text-red-600">{errors.homeownerLast.message}</p>
                )}
              </div>
            </div>

            {/* Row 2: Phone Number - Email Address */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  {...register('phone', { 
                    required: 'Phone is required',
                    pattern: {
                      value: /^[+]?[\d\s\-()]+$/,
                      message: 'Please enter a valid phone number'
                    }
                  })}
                  disabled={isFormDisabled}
                  className={`mt-1 block w-full px-2.5 py-2 rounded-lg border bg-white/80 backdrop-blur-sm shadow-subtle focus:outline-none focus:ring-2 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    phoneDuplicate 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 text-red-600' 
                      : 'border-neutral-200/50 focus:ring-cyan-500 focus:border-cyan-500 text-neutral-900'
                  }`}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600 font-medium">{errors.phone.message}</p>
                )}
                {phoneDuplicate && (
                  <p className="mt-1 text-sm text-red-600 font-medium flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1 text-red-600" /> Duplicate Warning
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Please enter a valid email address'
                    }
                  })}
                  disabled={isFormDisabled}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 font-medium">{errors.email.message}</p>
                )}
              </div>
            </div>

            {/* Real Estate Fields - Only show when NOT using a custom template */}
            {!selectedTemplate && (
              <>
            {/* Row 3: Market Value - Asking Price - Negotiable */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Market Value ($) *
                </label>
                <input
                  type="text"
                  {...register('marketValue', { required: 'Market value is required' })}
                  onChange={(e) => handleNumberInput(e, 'marketValue')}
                  disabled={isFormDisabled}
                  onFocus={(e) => { if (e.target.value === '0' || e.target.value === '') e.target.value = ''; }}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.marketValue && <p className="mt-1 text-sm text-red-600 font-medium">{errors.marketValue.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Asking Price ($)
                </label>
                <input
                  type="text"
                  {...register('askingPrice')}
                  onChange={(e) => handleNumberInput(e, 'askingPrice')}
                  disabled={isFormDisabled}
                  onFocus={(e) => { if (e.target.value === '0' || e.target.value === '') e.target.value = ''; }}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Negotiable *
                </label>
                <select
                  {...register('negotiable', { required: 'Please select if negotiable' })}
                  disabled={isFormDisabled}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {errors.negotiable && <p className="mt-1 text-sm text-red-600 font-medium">{errors.negotiable.message}</p>}
              </div>
            </div>

            {/* Row 4: Listing - Occupancy - Mortgage - Mortgage Amount */}
            <div className="grid grid-cols-4 gap-3">
              {(!selectedCampaignConfig || selectedCampaignConfig.listingStatus.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Listing {selectedCampaignConfig?.listingStatus.required !== false && '*'}
                  </label>
                  <select
                    {...register('listingStatus', { 
                      required: selectedCampaignConfig?.listingStatus.required !== false ? 'Listing status is required' : false 
                    })}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    {(!selectedCampaignConfig || selectedCampaignConfig.listingStatus.options.includes('ListedByOwner')) && (
                      <option value="ListedByOwner">Listed by Owner</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.listingStatus.options.includes('ListedByRealtor')) && (
                      <option value="ListedByRealtor">Listed by Realtor</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.listingStatus.options.includes('NotListed')) && (
                      <option value="NotListed">Not Listed</option>
                    )}
                  </select>
                  {errors.listingStatus && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.listingStatus.message}</p>
                  )}
                </div>
              )}

              {(!selectedCampaignConfig || selectedCampaignConfig.occupancy.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Occupancy {selectedCampaignConfig?.occupancy.required !== false && '*'}
                  </label>
                  <select
                    {...register('occupancy', { 
                      required: selectedCampaignConfig?.occupancy.required !== false ? 'Occupancy status is required' : false 
                    })}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    {(!selectedCampaignConfig || selectedCampaignConfig.occupancy.options.includes('OwnerOccupied')) && (
                      <option value="OwnerOccupied">Owner Occupied</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.occupancy.options.includes('RentedMTM')) && (
                      <option value="RentedMTM">Rented Month-to-Month</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.occupancy.options.includes('RentedAnnually')) && (
                      <option value="RentedAnnually">Rented Annually</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.occupancy.options.includes('Vacant')) && (
                      <option value="Vacant">Vacant</option>
                    )}
                  </select>
                  {errors.occupancy && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.occupancy.message}</p>
                  )}
                </div>
              )}

              {(!selectedCampaignConfig || selectedCampaignConfig.mortgage.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Mortgage {selectedCampaignConfig?.mortgage.required !== false && '*'}
                  </label>
                  <select
                    {...register('mortgage', { 
                      required: selectedCampaignConfig?.mortgage.required !== false ? 'Please select mortgage status' : false 
                    })}
                    disabled={isFormDisabled}
                    onChange={(e) => {
                      setValue('mortgage', e.target.value as 'Yes' | 'No' | '');
                      setShowMortgageAmount(e.target.value === 'Yes');
                    }}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  {errors.mortgage && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.mortgage.message}</p>
                  )}
                </div>
              )}

              {showMortgageAmount && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Mortgage Amount ($)
                  </label>
                  <input
                    type="text"
                    {...register('mortgageAmount')}
                    onChange={(e) => handleNumberInput(e, 'mortgageAmount')}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              )}
            </div>

            {/* Row 5: Property Type - License - (Beds - Bath) or (Size - Utilities) */}
            <div className="grid grid-cols-4 gap-3">
              {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Property Type {selectedCampaignConfig?.propertyType.required && '*'}
                  </label>
                  <select
                    {...register('propertyType', {
                      required: selectedCampaignConfig?.propertyType.required ? 'Property type is required' : false
                    })}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('SingleFamily')) && (
                      <option value="SingleFamilyHouse">Single Family House</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('MultiFamily')) && (
                      <option value="MultiFamilyHouse">Multi Family House</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('Condo')) && (
                      <option value="Condo">Condo</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('Townhouse')) && (
                      <option value="TownHouse">Town House</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('VacantLots')) && (
                      <option value="VacantLots">Vacant Lots</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('Apartment')) && (
                      <option value="Apartment">Apartment</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('MobileHome')) && (
                      <option value="MobileHome">Mobile Home</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.propertyType.options.includes('MobileHomeAndLot')) && (
                      <option value="MobileHomeAndLot">Mobile Home & Lot</option>
                    )}
                  </select>
                  {errors.propertyType && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.propertyType.message}</p>
                  )}
                </div>
              )}

              {(!selectedCampaignConfig || selectedCampaignConfig.license.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    License {selectedCampaignConfig?.license.required && '*'}
                  </label>
                  <select
                    {...register('license', {
                      required: selectedCampaignConfig?.license.required ? 'License is required' : false
                    })}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    {(!selectedCampaignConfig || selectedCampaignConfig.license.options.includes('Residential')) && (
                      <option value="Residential">Residential</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.license.options.includes('Commercial')) && (
                      <option value="Commercial">Commercial</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.license.options.includes('Agriculture')) && (
                      <option value="Agriculture">Agriculture</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.license.options.includes('MixedUse')) && (
                      <option value="MixedUse">Mixed Use</option>
                    )}
                  </select>
                  {errors.license && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.license.message}</p>
                  )}
                </div>
              )}

              {/* Conditional: Beds - Bath OR Size - Utilities */}
              {isVacantLot ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                      Size
                    </label>
                    <input
                      type="number"
                      {...register('size', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Must be 0 or more' }
                      })}
                      disabled={isFormDisabled}
                      onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                      className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                      Utilities
                    </label>
                    <select
                      {...register('utilities')}
                      disabled={isFormDisabled}
                      className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value=""></option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                      Beds
                    </label>
                    <input
                      type="number"
                      {...register('bedrooms', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Must be 0 or more' },
                        max: { value: 10, message: 'Must be 10 or less' }
                      })}
                      disabled={isFormDisabled}
                      onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                      className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.bedrooms && (
                      <p className="mt-1 text-sm text-red-600 font-medium">{errors.bedrooms.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                      Bath
                    </label>
                    <input
                      type="number"
                      {...register('bathrooms', {
                        valueAsNumber: true,
                        min: { value: 0, message: 'Must be 0 or more' },
                        max: { value: 10, message: 'Must be 10 or less' }
                      })}
                      disabled={isFormDisabled}
                      onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                      className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {errors.bathrooms && (
                      <p className="mt-1 text-sm text-red-600 font-medium">{errors.bathrooms.message}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Row 6: Property Address */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                Property Address *
              </label>
              <textarea
                rows={2}
                {...register('addressText', { 
                  required: 'Address is required',
                  minLength: { value: 10, message: 'Address must be at least 10 characters' }
                })}
                disabled={isFormDisabled}
                className={`mt-1 block w-full px-2.5 py-2 rounded-lg border bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  addressDuplicate
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-neutral-200/50 focus:ring-cyan-500 focus:border-cyan-500'
                }`}
              />
              {errors.addressText && (
                <p className="mt-1 text-sm text-red-600 font-medium">{errors.addressText.message}</p>
              )}
              {addressDuplicate && (
                <p className="mt-1 text-sm text-red-600 font-medium flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-red-600" /> Duplicate Warning
                </p>
              )}
            </div>

            {/* Row 7: Selling Reason - Ownership Timeline - Closing Timeline */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Selling Reason *
                </label>
                <select
                  {...register('sellingReason', { required: 'Selling reason is required' })}
                  disabled={isFormDisabled}
                  className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value=""></option>
                  <option value="Downsize">Downsize</option>
                  <option value="Upgrade">Upgrade</option>
                  <option value="Relocate">Relocate</option>
                  <option value="TiredOfBeingLandlord">Tired of being landlord</option>
                  <option value="GettingOld">Getting old</option>
                  <option value="Retirement">Retirement</option>
                  <option value="InvestingInAnotherProperty">Investing in another property</option>
                  <option value="Liquidate">Liquidate</option>
                  <option value="TaxIssues">Tax issues</option>
                  <option value="DontNeedIt">Don't need it</option>
                  <option value="BuyNewProperty">Buy new property</option>
                  <option value="MoneyFactor">Money factor</option>
                </select>
                {errors.sellingReason && <p className="mt-1 text-sm text-red-600 font-medium">{errors.sellingReason.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                  Ownership Timeline *
                </label>
                <div className="flex">
                  <input
                    type="number"
                    {...register('ownershipTimelineValue', {
                      required: 'Ownership timeline value is required',
                      valueAsNumber: true,
                      min: { value: 1, message: 'Must be at least 1' },
                      max: { value: 99, message: 'Must be 99 or less' }
                    })}
                    disabled={isFormDisabled}
                    onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                    style={{ MozAppearance: 'textfield', WebkitAppearance: 'none', appearance: 'textfield' }}
                    className="mt-1 w-20 px-2.5 py-2 border border-r-0 border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <div className="mt-1 flex border border-neutral-200/50 bg-white/80 rounded-r-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setValue('ownershipTimelineUnit', 'months')}
                      disabled={isFormDisabled}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        watch('ownershipTimelineUnit') === 'months'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-white/80 text-gray-700 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('ownershipTimelineUnit', 'years')}
                      disabled={isFormDisabled}
                      className={`px-3 py-2 text-sm font-medium border-l border-neutral-200/50 transition-colors ${
                        watch('ownershipTimelineUnit') === 'years'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-white/80 text-gray-700 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      Years
                    </button>
                  </div>
                </div>
                {errors.ownershipTimelineValue && <p className="mt-1 text-sm text-red-600">{errors.ownershipTimelineValue.message}</p>}
                {errors.ownershipTimelineUnit && <p className="mt-1 text-sm text-red-600">{errors.ownershipTimelineUnit.message}</p>}
              </div>

              {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.enabled) && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                    Closing Timeline {selectedCampaignConfig?.closingTimeline.required !== false && '*'}
                  </label>
                  <select
                    {...register('closingTimeline', { 
                      required: selectedCampaignConfig?.closingTimeline.required !== false ? 'Closing timeline is required' : false 
                    })}
                    disabled={isFormDisabled}
                    className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value=""></option>
                    {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.options.includes('Asap')) && (
                      <option value="Asap">ASAP</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.options.includes('ThirtyDays')) && (
                      <option value="ThirtyDays">30 Days</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.options.includes('SixtyDays')) && (
                      <option value="SixtyDays">60 Days</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.options.includes('NinetyDays')) && (
                      <option value="NinetyDays">90 Days</option>
                    )}
                    {(!selectedCampaignConfig || selectedCampaignConfig.closingTimeline.options.includes('SixMonths')) && (
                      <option value="SixMonths">6 Months</option>
                    )}
                    <option value="Anytime">Anytime</option>
                  </select>
                  {errors.closingTimeline && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{errors.closingTimeline.message}</p>
                  )}
                </div>
              )}
            </div>

              </>
            )}

            {/* Custom Fields from Template */}
            {selectedTemplate && selectedTemplate.fields && selectedTemplate.fields.length > 0 && (
              <div className="grid grid-cols-12 gap-4">
                  {selectedTemplate.fields.map((field) => {
                    const widthClass = 
                      field.fieldType === 'section' || field.fieldType === 'separator' || field.fieldType === 'rating' ? 'col-span-12' :
                      field.width === 'full' ? 'col-span-12' :
                      field.width === 'half' ? 'col-span-6' :
                      field.width === 'third' ? 'col-span-4' :
                      'col-span-3';

                    // Section Header
                    if (field.fieldType === 'section') {
                      return (
                        <div key={field.id} className="col-span-12 pt-0 pb-2">
                          <h4 className="text-lg font-bold text-gray-800">{field.label}</h4>
                        </div>
                      );
                    }

                    // Separator
                    if (field.fieldType === 'separator') {
                      return (
                        <div key={field.id} className="col-span-12 py-0">
                          <hr className="border-t-2 border-gray-300" />
                        </div>
                      );
                    }

                    // Regular Fields
                    return (
                      <div key={field.id} className={widthClass}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        
                        {/* Text Input */}
                        {(field.fieldType === 'text' || field.fieldType === 'phone' || field.fieldType === 'email') && (
                          <input
                            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Address Field (Multi-line) */}
                        {field.fieldType === 'address' && (
                          <textarea
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            rows={3}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Textarea */}
                        {field.fieldType === 'textarea' && (
                          <textarea
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            rows={3}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Number/Currency */}
                        {field.fieldType === 'number' && (
                          <input
                            type="number"
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            placeholder={field.placeholder}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}
                        
                        {/* Currency with thousand separator */}
                        {field.fieldType === 'currency' && (
                          <input
                            type="text"
                            value={customFieldValues[field.id] ? Number(customFieldValues[field.id]).toLocaleString('en-US') : ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/,/g, '');
                              if (value === '' || !isNaN(Number(value))) {
                                setCustomFieldValues({...customFieldValues, [field.id]: value});
                              }
                            }}
                            required={field.required}
                            disabled={isFormDisabled}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Date */}
                        {field.fieldType === 'date' && (
                          <input
                            type="date"
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Time */}
                        {field.fieldType === 'time' && (
                          <input
                            type="time"
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        )}

                        {/* Dropdown */}
                        {field.fieldType === 'dropdown' && (
                          <select
                            value={customFieldValues[field.id] || ''}
                            onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                            required={field.required}
                            disabled={isFormDisabled}
                            className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="">Select an option</option>
                            {field.options?.map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {/* Radio */}
                        {field.fieldType === 'radio' && (
                          <div className="space-y-2">
                            {field.options?.map((opt, idx) => (
                              <label key={idx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={field.id}
                                  value={opt}
                                  checked={customFieldValues[field.id] === opt}
                                  onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.value})}
                                  required={field.required && idx === 0}
                                  disabled={isFormDisabled}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Checkbox */}
                        {field.fieldType === 'checkbox' && (
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={customFieldValues[field.id] || false}
                              onChange={(e) => setCustomFieldValues({...customFieldValues, [field.id]: e.target.checked})}
                              required={field.required}
                              disabled={isFormDisabled}
                            />
                            <span>{field.label}</span>
                          </label>
                        )}

                        {/* Checkbox Group */}
                        {field.fieldType === 'checkboxgroup' && (
                          <div className="space-y-2">
                            {field.options?.map((opt, idx) => (
                              <label key={idx} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={(customFieldValues[field.id] || []).includes(opt)}
                                  onChange={(e) => {
                                    const current = customFieldValues[field.id] || [];
                                    const updated = e.target.checked
                                      ? [...current, opt]
                                      : current.filter((v: string) => v !== opt);
                                    setCustomFieldValues({...customFieldValues, [field.id]: updated});
                                  }}
                                  disabled={isFormDisabled}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Rating */}
                        {field.fieldType === 'rating' && (
                          <div className="flex space-x-2">
                            {Array.from({ length: field.ratingMax || 10 }, (_, i) => i + 1).map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setCustomFieldValues({...customFieldValues, [field.id]: num})}
                                disabled={isFormDisabled}
                                className={`flex-1 py-2 border transition-colors text-sm font-medium ${
                                  customFieldValues[field.id] === num
                                    ? 'bg-cyan-600 text-white border-cyan-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-cyan-500'
                                } disabled:opacity-50`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Rating Boxes - Only show when NOT using a custom template */}
            {!selectedTemplate && (
              <>
            <div className="space-y-4">
              <RatingBox
                type="motivation"
                label="Motivation Rating (1-10) *"
                currentValue={motivationRating}
              />

              <RatingBox
                type="condition"
                label="Condition Rating (1-10) *"
                currentValue={conditionRating}
              />
            </div>

            {/* Additional Information */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2" style={{ letterSpacing: '0.01em' }}>
                Additional Information
              </label>
              <textarea
                rows={2}
                {...register('additionalInfo')}
                disabled={isFormDisabled}
                className="mt-1 block w-full px-2.5 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
              </>
            )}

            {/* Submit Confirmation */}
            <div className="border-t border-neutral-200/50 pt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('submitCheckboxFlag', { 
                    required: 'You must confirm submission' 
                  })}
                  disabled={isFormDisabled}
                  className="rounded border-neutral-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
                />
                <span className="ml-2 text-sm text-neutral-700">
                  Confirm to submit lead
                </span>
              </label>
              {errors.submitCheckboxFlag && (
                <p className="mt-1 text-sm text-red-600 font-medium">{errors.submitCheckboxFlag.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  reset({
                    campaignId: '',
                    homeownerFirst: '',
                    homeownerLast: '',
                    phone: '',
                    email: '',
                    marketValue: 0,
                    askingPrice: 0,
                    negotiable: '',
                    listingStatus: '',
                    occupancy: '',
                    mortgage: '',
                    mortgageAmount: 0,
                    propertyType: '',
                    license: '',
                    bedrooms: 0,
                    bathrooms: 0,
                    size: 0,
                    utilities: '',
                    addressText: '',
                    sellingReason: '',
                    ownershipTimelineValue: 0,
                    ownershipTimelineUnit: '',
                    closingTimeline: '',
                    motivationRating: 5,
                    conditionRating: 5,
                    additionalInfo: '',
                    submitCheckboxFlag: false
                  });
                  setMotivationRating(5);
                  setConditionRating(5);
                  setSuccessMessage('');
                  setShowMortgageAmount(false);
                }}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={loading || isFormDisabled}
                className="px-6 py-2.5 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Submit Lead'
                )}
              </button>
            </div>
          </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-3xl">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-6">
        {formContent}
      </div>
    </Layout>
  );
};

export default SubmitLead;




