import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { Plus, Trash2, GripVertical, Save, ArrowLeft, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

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
  description?: string;
  fields: CustomField[];
  createdAt: string;
  _count?: {
    campaigns: number;
  };
}

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning } = useToast();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Form state for adding/editing fields
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomField['fieldType']>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldWidth, setFieldWidth] = useState<CustomField['width']>('full');

  const fieldTypes = [
    { value: 'text', label: 'Single Line Text' },
    { value: 'textarea', label: 'Multi-line Text' },
    { value: 'number', label: 'Number' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'radio', label: 'Radio Buttons' },
    { value: 'checkbox', label: 'Single Checkbox' },
    { value: 'checkboxgroup', label: 'Checkbox Group' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'address', label: 'Address (for duplicate check)' },
    { value: 'currency', label: 'Currency' },
    { value: 'rating', label: 'Rating Scale (1-10)' },
    { value: 'section', label: 'Section Header' },
    { value: 'separator', label: 'Separator Line' },
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/form-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddFieldModal = () => {
    setEditingField(null);
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldPlaceholder('');
    setFieldOptions('');
    setFieldWidth('full');
    setShowFieldModal(true);
  };

  const openEditFieldModal = (field: CustomField) => {
    setEditingField(field);
    setFieldLabel(field.label);
    setFieldType(field.fieldType);
    setFieldRequired(field.required);
    setFieldPlaceholder(field.placeholder || '');
    setFieldOptions(field.options?.join('\n') || '');
    setFieldWidth(field.width);
    setShowFieldModal(true);
  };

  const saveField = () => {
    if (!fieldLabel.trim()) {
      showWarning('Field label is required');
      return;
    }

    const needsOptions = ['dropdown', 'radio', 'checkboxgroup'].includes(fieldType);
    const optionsArray = fieldOptions.split('\n').filter(opt => opt.trim());
    
    if (needsOptions && optionsArray.length === 0) {
      showWarning('Please provide options for this field type');
      return;
    }

    const newField: CustomField = {
      id: editingField?.id || `field_${Date.now()}`,
      label: fieldLabel.trim(),
      fieldType,
      required: fieldRequired,
      placeholder: fieldPlaceholder.trim() || undefined,
      options: needsOptions ? optionsArray : undefined,
      order: editingField?.order || fields.length,
      width: fieldWidth,
    };

    if (editingField) {
      setFields(fields.map(f => f.id === editingField.id ? newField : f));
    } else {
      setFields([...fields, newField]);
    }

    setShowFieldModal(false);
  };

  const deleteField = (id: string) => {
    const deletedField = fields.find(f => f.id === id);
    setFields(fields.filter(f => f.id !== id));
    showSuccess(`Field "${deletedField?.label || 'Field'}" deleted`);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    newFields.forEach((field, idx) => field.order = idx);
    
    setFields(newFields);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      showWarning('Please enter a template name');
      return;
    }
    if (fields.length === 0) {
      showWarning('Please add at least one field');
      return;
    }

    try {
      if (editingTemplate) {
        await api.put(`/form-templates/${editingTemplate.id}`, {
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          fields
        });
        showSuccess('Template updated successfully!');
      } else {
        await api.post('/form-templates', {
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          fields
        });
        showSuccess('Template saved successfully!');
      }
      
      await loadTemplates();
      resetBuilder();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to save template');
    }
  };

  const loadTemplate = (template: FormTemplate) => {
    setEditingTemplate(template);
    setFields(JSON.parse(JSON.stringify(template.fields)));
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
  };

  const deleteTemplate = async (id: string, name: string) => {
    try {
      await api.delete(`/form-templates/${id}`);
      showSuccess(`Template "${name}" deleted successfully`);
      await loadTemplates();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const resetBuilder = () => {
    setEditingTemplate(null);
    setFields([]);
    setTemplateName('');
    setTemplateDescription('');
    setShowSaveModal(false);
  };

  const renderFieldPreview = (field: CustomField) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500";
    
    switch (field.fieldType) {
      case 'text':
        return (
          <input
            type="text"
            placeholder={field.placeholder}
            className={baseClasses}
            disabled
          />
        );
      case 'address':
        return (
          <textarea
            placeholder={field.placeholder || 'Enter full address'}
            className={baseClasses}
            rows={3}
            disabled
          />
        );
      case 'textarea':
        return (
          <textarea
            placeholder={field.placeholder}
            className={baseClasses}
            rows={3}
            disabled
          />
        );
      case 'number':
        return (
          <input
            type="number"
            placeholder={field.placeholder}
            className={baseClasses}
            disabled
          />
        );
      case 'currency':
        return (
          <input
            type="text"
            placeholder={field.placeholder || "e.g., 250,000"}
            className={baseClasses}
            disabled
          />
        );
      case 'date':
        return (
          <input
            type="date"
            className={baseClasses}
            disabled
          />
        );
      case 'time':
        return (
          <input
            type="time"
            className={baseClasses}
            disabled
          />
        );
      case 'dropdown':
        return (
          <select className={baseClasses} disabled>
            <option value="">Select an option</option>
            {field.options?.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2">
                <input type="radio" name={field.id} disabled />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input type="checkbox" disabled />
            <span>{field.label}</span>
          </label>
        );
      case 'checkboxgroup':
        return (
          <div className="space-y-2">
            {field.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2">
                <input type="checkbox" disabled />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'rating':
        const maxRating = field.ratingMax || 10;
        return (
          <div className="flex space-x-2">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                disabled
                className={`flex-1 py-2 border transition-colors text-sm font-medium ${
                  num === 5 
                    ? 'bg-cyan-600 text-white border-cyan-600' 
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        );
      case 'section':
        return (
          <div className="col-span-12 pt-0 pb-2">
            <h3 className="text-lg font-bold text-gray-800">
              {field.label}
            </h3>
          </div>
        );
      case 'separator':
        return (
          <div className="col-span-12 py-0">
            <hr className="border-t-2 border-gray-300" />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin/campaigns')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back to Campaigns</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Builder</h1>
          <p className="text-sm text-gray-600">
            Create and manage custom form templates for different campaign types
          </p>
        </div>

        {/* Saved Templates List */}
        {!editingTemplate && fields.length === 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Saved Templates</h2>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  // Add a placeholder field to trigger the editor view
                  setFields([{ 
                    id: `placeholder_${Date.now()}`, 
                    label: 'Click "Add Field" to start building your form', 
                    fieldType: 'section', 
                    required: false, 
                    order: 0, 
                    width: 'full' 
                  }]);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create New Template
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300 shadow-sm">
                <p className="text-gray-500 mb-2">No templates created yet</p>
                <p className="text-sm text-gray-400">Click "Create New Template" to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 border-l-4 hover:shadow-md transition-all" style={{ borderLeftColor: '#f5f5f4' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <span>{template.fields.length} fields</span>
                      <span>{template._count?.campaigns || 0} campaigns</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadTemplate(template)}
                        className="flex-1 px-3 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id, template.name)}
                        className="px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Field Builder */}
        {(editingTemplate || fields.length > 0 || (!loading && templates.length === 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side - Field Configuration */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 border-l-4" style={{ borderLeftColor: '#f5f5f4' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingTemplate ? `Editing: ${editingTemplate.name}` : 'New Template'}
                </h2>
                <div className="flex gap-2">
                  {fields.length > 0 && (
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  )}
                  <button
                    onClick={openAddFieldModal}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                  {(editingTemplate || fields.length > 0) && (
                    <button
                      onClick={() => navigate('/admin/campaigns/form-builder')}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                </div>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-2">No fields added yet</p>
                  <p className="text-sm">Click "Add Field" to create your first field</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <button
                          onClick={() => moveField(index, 'down')}
                          disabled={index === fields.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{field.label}</span>
                          {field.required && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                          )}
                          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded">
                            {field.width === 'full' ? '100%' : 
                             field.width === 'half' ? '50%' : 
                             field.width === 'third' ? '33%' : '25%'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Type: {fieldTypes.find(t => t.value === field.fieldType)?.label}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditFieldModal(field)}
                          className="px-3 py-1 text-sm bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteField(field.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side - Form Preview */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 border-l-4" style={{ borderLeftColor: '#f5f5f4' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Form Preview</h2>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>

              {showPreview ? (
                <div>
                  {/* Default Fields Section */}
                  <div className="mb-6">
                    {/* Row 1: Campaign - First Name - Last Name */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Campaign <span className="text-red-500 ml-1">*</span>
                        </label>
                        <select
                          className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                          disabled
                        >
                          <option value="">Select campaign...</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          First Name <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter first name"
                          className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                          disabled
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Last Name <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter last name"
                          className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                          disabled
                        />
                      </div>
                    </div>
                    
                    {/* Row 2: Phone Number - Email Address */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Phone Number <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="(555) 123-4567"
                          className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                          disabled
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Email Address <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="email@example.com"
                          className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                          disabled
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields Section */}
                  {fields.length > 0 && (
                    <div className="mb-6">
                      <div className="grid grid-cols-12 gap-4">
                        {fields.map(field => {
                          const widthClass = 
                            field.fieldType === 'section' || field.fieldType === 'separator' || field.fieldType === 'rating' ? 'col-span-12' :
                            field.width === 'full' ? 'col-span-12' :
                            field.width === 'half' ? 'col-span-6' :
                            field.width === 'third' ? 'col-span-4' :
                            'col-span-3';
                          
                          if (field.fieldType === 'section' || field.fieldType === 'separator') {
                            return (
                              <div key={field.id} className={widthClass}>
                                {renderFieldPreview(field)}
                              </div>
                            );
                          }
                          
                          return (
                            <div key={field.id} className={widthClass}>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {field.label}
                                {field.required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              {renderFieldPreview(field)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Submit Confirmation */}
                  <div className="border-t border-neutral-200/50 pt-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        disabled
                        className="rounded border-neutral-300 text-mint-600 focus:ring-mint-400"
                      />
                      <span className="ml-2 text-sm text-neutral-700">
                        Confirm to submit lead
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  {fields.length === 0 ? (
                    <p>Add fields to see the preview</p>
                  ) : (
                    <p>Click "Show Preview" to see how the form will look</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Field Modal */}
        {showFieldModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {editingField ? 'Edit Field' : 'Add New Field'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fieldLabel}
                      onChange={(e) => setFieldLabel(e.target.value)}
                      placeholder="e.g., System Size, Budget Range"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as CustomField['fieldType'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                    >
                      {fieldTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  {!['checkbox', 'section', 'separator'].includes(fieldType) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placeholder Text
                      </label>
                      <input
                        type="text"
                        value={fieldPlaceholder}
                        onChange={(e) => setFieldPlaceholder(e.target.value)}
                        placeholder="Optional hint text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                      />
                    </div>
                  )}

                  {['dropdown', 'radio', 'checkboxgroup'].includes(fieldType) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Options <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        placeholder="Enter each option on a new line"
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                      />
                    </div>
                  )}

                  {!['section', 'separator', 'rating'].includes(fieldType) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Width
                      </label>
                      <select
                        value={fieldWidth}
                        onChange={(e) => setFieldWidth(e.target.value as CustomField['width'])}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                      >
                        <option value="full">Full Width (100%)</option>
                        <option value="half">Half Width (50%)</option>
                        <option value="third">Third Width (33%)</option>
                        <option value="quarter">Quarter Width (25%)</option>
                      </select>
                    </div>
                  )}

                  {!['section', 'separator'].includes(fieldType) && (
                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={fieldRequired}
                          onChange={(e) => setFieldRequired(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">Required Field</span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={saveField}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                  >
                    {editingField ? 'Update Field' : 'Add Field'}
                  </button>
                  <button
                    onClick={() => setShowFieldModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Template Modal */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {editingTemplate ? 'Update Template' : 'Save Template'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Solar Campaign Template"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of this template"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">
                      <strong>{fields.length} fields</strong> will be saved in this template
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={saveTemplate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    {editingTemplate ? 'Update' : 'Save'} Template
                  </button>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
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

export default FormBuilder;




