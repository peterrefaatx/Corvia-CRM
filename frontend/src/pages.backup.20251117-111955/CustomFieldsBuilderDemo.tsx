import React, { useState } from 'react';
import Layout from '../components/Layout/Layout';
import { Plus, Trash2, GripVertical, Eye, Save, Upload } from 'lucide-react';

interface CustomField {
  id: string;
  label: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'radio' | 'checkbox' | 'checkboxgroup' | 'date' | 'phone' | 'email' | 'currency' | 'rating' | 'section' | 'separator';
  required: boolean;
  placeholder?: string;
  options?: string[];
  order: number;
  width: 'full' | 'half' | 'third' | 'quarter';
  ratingMax?: number; // For rating fields: max value (default 10)
}

const CustomFieldsBuilderDemo: React.FC = () => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showLeadPreview, setShowLeadPreview] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; fields: CustomField[] }[]>([]);

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
    { value: 'radio', label: 'Radio Buttons (Select One)' },
    { value: 'checkbox', label: 'Single Checkbox' },
    { value: 'checkboxgroup', label: '☑️ Checkbox Group (Select Multiple)' },
    { value: 'date', label: 'Date' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'email', label: 'Email' },
    { value: 'currency', label: 'Currency' },
    { value: 'rating', label: '⭐ Rating Scale (1-10)' },
    { value: 'section', label: '📋 Section Header' },
    { value: 'separator', label: '➖ Separator Line' },
  ];

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
      alert('Field label is required');
      return;
    }

    const needsOptions = ['dropdown', 'radio', 'checkboxgroup'].includes(fieldType);
    const optionsArray = fieldOptions.split('\n').filter(opt => opt.trim());
    
    if (needsOptions && optionsArray.length === 0) {
      alert('Please provide options for this field type');
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
    if (confirm('Are you sure you want to delete this field?')) {
      setFields(fields.filter(f => f.id !== id));
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    newFields.forEach((field, idx) => field.order = idx);
    
    setFields(newFields);
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (fields.length === 0) {
      alert('Please add at least one field before saving');
      return;
    }
    
    const newTemplate = {
      name: templateName.trim(),
      fields: JSON.parse(JSON.stringify(fields)) // Deep copy
    };
    
    setSavedTemplates([...savedTemplates, newTemplate]);
    setTemplateName('');
    setShowTemplateModal(false);
    alert(`Template "${newTemplate.name}" saved successfully!`);
  };

  const loadTemplate = (template: { name: string; fields: CustomField[] }) => {
    if (fields.length > 0) {
      if (!confirm('Loading a template will replace your current fields. Continue?')) {
        return;
      }
    }
    setFields(JSON.parse(JSON.stringify(template.fields))); // Deep copy
    alert(`Template "${template.name}" loaded successfully!`);
  };

  const deleteTemplate = (templateName: string) => {
    if (confirm(`Delete template "${templateName}"?`)) {
      setSavedTemplates(savedTemplates.filter(t => t.name !== templateName));
    }
  };

  const renderFieldPreview = (field: CustomField) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";
    
    switch (field.fieldType) {
      case 'text':
      case 'phone':
      case 'email':
        return (
          <input
            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
            placeholder={field.placeholder}
            className={baseClasses}
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
      case 'currency':
        return (
          <input
            type="number"
            placeholder={field.placeholder}
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
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Fields Builder - Demo</h1>
          <p className="text-gray-600">
            This is a prototype to demonstrate how custom fields can be configured for different campaign types.
          </p>
        </div>

        {/* Saved Templates Section */}
        {savedTemplates.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Saved Templates</h3>
            <p className="text-sm text-gray-700 mb-4">
              Load a saved template to quickly configure similar campaigns
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {savedTemplates.map((template, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{template.name}</p>
                      <p className="text-xs text-gray-500">{template.fields.length} fields</p>
                    </div>
                    <button
                      onClick={() => deleteTemplate(template.name)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => loadTemplate(template)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    <Upload className="w-4 h-4" />
                    Load Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Default Fields Info */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Default Fields (Always Present)</h3>
          <p className="text-sm text-gray-700 mb-4">
            These fields are <strong>required for all campaigns</strong> and will always appear in the Submit Lead form:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">Campaign</p>
              <p className="text-xs text-gray-500">Required (System)</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">First Name</p>
              <p className="text-xs text-gray-500">Required</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">Last Name</p>
              <p className="text-xs text-gray-500">Required</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">Phone Number</p>
              <p className="text-xs text-gray-500">Required</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-200">
              <p className="text-sm font-semibold text-gray-900">Email</p>
              <p className="text-xs text-gray-500">Required</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-4">
            ℹ️ Custom fields you create below will be added <strong>between</strong> these default fields and the confirmation checkbox at the end.
          </p>
          <div className="mt-3 p-2 bg-white rounded border border-blue-200">
            <p className="text-xs font-semibold text-gray-700">
              📋 Also included: "Confirm to submit lead" checkbox (appears at the end of every form)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Field Builder */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Field Configuration</h2>
              <div className="flex gap-2">
                <button
                  onClick={openAddFieldModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
                {fields.length > 0 && (
                  <button
                    onClick={() => setShowTemplateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Save Template
                  </button>
                )}
              </div>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-2">No custom fields added yet</p>
                <p className="text-sm">Click "Add Field" to create your first custom field</p>
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
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
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
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
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

          {/* Right Side - Preview */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Form Preview</h2>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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
                    {/* Campaign */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Campaign <span className="text-red-500 ml-1">*</span>
                      </label>
                      <select
                        className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                        disabled
                      >
                        <option value="">Select campaign...</option>
                        <option>Solar Campaign</option>
                        <option>Remodeling Campaign</option>
                        <option>Insurance Campaign</option>
                      </select>
                    </div>
                    
                    {/* First Name */}
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
                    
                    {/* Last Name */}
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
                    {/* Phone Number */}
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
                    
                    {/* Email */}
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
                        // Section headers, separators, and ratings always span full width
                        const widthClass = 
                          field.fieldType === 'section' || field.fieldType === 'separator' || field.fieldType === 'rating' ? 'col-span-12' :
                          field.width === 'full' ? 'col-span-12' :
                          field.width === 'half' ? 'col-span-6' :
                          field.width === 'third' ? 'col-span-4' :
                          'col-span-3'; // quarter
                        
                        // Section headers and separators don't need labels
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

                {/* Submit Confirmation - Always at the end */}
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

        {/* Field Configuration Modal */}
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
                      placeholder="e.g., System Size, Budget Range, Project Type"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as CustomField['fieldType'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {fieldType === 'section' && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>📋 Section Header:</strong> Creates a new section that groups all fields that follow it.
                      </p>
                      <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc space-y-1">
                        <li><strong>In Form:</strong> Shows as bold heading with underline</li>
                        <li><strong>In Lead Details:</strong> Creates a separate bordered section with this title</li>
                        <li>All fields after this header belong to this section until the next section header</li>
                      </ul>
                    </div>
                  )}

                  {fieldType === 'separator' && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Separator Line:</strong> Adds a horizontal line to visually divide sections of the form. 
                        The label is just for your reference and won't be shown to users.
                      </p>
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
                        placeholder="Enter each option on a new line&#10;Option 1&#10;Option 2&#10;Option 3"
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {fieldType === 'checkboxgroup' ? 'Users can select multiple options' : 'Enter each option on a new line'}
                      </p>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="full">Full Width (100%)</option>
                        <option value="half">Half Width (50%) - 2 per row</option>
                        <option value="third">Third Width (33%) - 3 per row</option>
                        <option value="quarter">Quarter Width (25%) - 4 per row</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Control how wide this field appears and how many fit on one line
                      </p>
                    </div>
                  )}

                  {fieldType === 'rating' && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>⭐ Rating Scale:</strong> Creates clickable boxes from 1-10 (like Motivation Rating). 
                        Perfect for scoring or rating fields. Always spans full width.
                      </p>
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Save as Template
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Save this field configuration to reuse for similar campaigns
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Solar Campaign Template, Insurance Form"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
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
                    onClick={saveAsTemplate}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Save Template
                  </button>
                  <button
                    onClick={() => {
                      setShowTemplateModal(false);
                      setTemplateName('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lead Preview Section */}
        {fields.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">How Custom Fields Appear in Leads</h2>
              <button
                onClick={() => setShowLeadPreview(!showLeadPreview)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Eye className="w-4 h-4" />
                {showLeadPreview ? 'Hide' : 'Show'} Lead Preview
              </button>
            </div>

            {showLeadPreview && (
              <div className="grid grid-cols-1 gap-6">
                {/* Lead Details View */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Lead Details View</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    This is how custom fields will appear when viewing a lead's full details:
                  </p>
                  
                  {/* Mock Lead Details */}
                  <div className="border border-gray-200 rounded-lg p-6">
                    {/* Standard Fields */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">Contact Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Name</p>
                          <p className="text-sm font-medium">John Doe</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium">(555) 123-4567</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium">john.doe@example.com</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="text-sm font-medium">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Qualified</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Custom Fields Sections - Grouped by Section Headers */}
                    {(() => {
                      // Group fields by sections
                      const sections: { title: string; fields: CustomField[] }[] = [];
                      let currentSection = { title: 'Campaign Specific Information', fields: [] as CustomField[] };
                      
                      fields.forEach(field => {
                        if (field.fieldType === 'section') {
                          // Save current section if it has fields
                          if (currentSection.fields.length > 0) {
                            sections.push(currentSection);
                          }
                          // Start new section
                          currentSection = { title: field.label, fields: [] };
                        } else if (field.fieldType !== 'separator') {
                          // Add field to current section (skip separators in details view)
                          currentSection.fields.push(field);
                        }
                      });
                      
                      // Add last section
                      if (currentSection.fields.length > 0) {
                        sections.push(currentSection);
                      }
                      
                      // If no sections, show all fields under default title
                      if (sections.length === 0 && fields.filter(f => f.fieldType !== 'separator' && f.fieldType !== 'section').length > 0) {
                        sections.push({
                          title: 'Campaign Specific Information',
                          fields: fields.filter(f => f.fieldType !== 'separator' && f.fieldType !== 'section')
                        });
                      }
                      
                      return sections.map((section, idx) => (
                        <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
                          <h4 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">{section.title}</h4>
                          <div className="grid grid-cols-2 gap-4">
                            {section.fields.map(field => (
                              <div key={field.id}>
                                <p className="text-xs text-gray-500">{field.label}</p>
                                <p className="text-sm font-medium text-gray-700">
                                  {field.fieldType === 'dropdown' && field.options ? field.options[0] :
                                   field.fieldType === 'currency' ? '$45,000' :
                                   field.fieldType === 'number' ? '2,500' :
                                   field.fieldType === 'date' ? '2024-12-15' :
                                   field.fieldType === 'checkbox' ? '✓ Yes' :
                                   field.fieldType === 'radio' && field.options ? field.options[0] :
                                   field.fieldType === 'rating' ? '7/10' :
                                   'Sample data'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Leads List View - Matching Current System */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Leads List View (Table)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    The leads table shows only <strong>default fields</strong> - same for all campaigns (matches current system):
                  </p>
                  
                  <div className="overflow-x-auto rounded-b-2xl border border-neutral-200/50">
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
                        <tr className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                              SOL-2024-001
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Solar Campaign
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <p className="text-sm font-medium text-neutral-900">
                              John Doe
                            </p>
                            <p className="text-xs text-neutral-600">john.doe@email.com</p>
                            <p className="text-xs text-neutral-600">(555) 123-4567</p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Agent Smith
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm text-neutral-700">
                              12/15/24 10:30 AM
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Qualified
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              View
                            </button>
                          </td>
                        </tr>
                        <tr className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                              REM-2024-042
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Remodeling
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <p className="text-sm font-medium text-neutral-900">
                              Jane Smith
                            </p>
                            <p className="text-xs text-neutral-600">jane.smith@email.com</p>
                            <p className="text-xs text-neutral-600">(555) 987-6543</p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Agent Jones
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm text-neutral-700">
                              12/16/24 2:15 PM
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              View
                            </button>
                          </td>
                        </tr>
                        <tr className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                              INS-2024-089
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Insurance
                            </p>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <p className="text-sm font-medium text-neutral-900">
                              Bob Wilson
                            </p>
                            <p className="text-xs text-neutral-600">bob.w@email.com</p>
                            <p className="text-xs text-neutral-600">(555) 456-7890</p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm font-medium text-neutral-700">
                              Agent Brown
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <p className="text-sm text-neutral-700">
                              12/17/24 9:45 AM
                            </p>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Disqualified
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              View
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>✓ Consistent View:</strong> The leads list looks exactly the same regardless of campaign type (Solar, Remodeling, Insurance, etc.). 
                      Custom fields are only visible in the Lead Details view.
                    </p>
                  </div>
                </div>

                {/* Excel Export Preview */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Excel Export</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Excel exports include <strong>default fields + custom fields</strong> as columns:
                  </p>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <div className="font-mono text-xs min-w-max">
                      {/* Header Row */}
                      <div className="flex gap-3 mb-2 font-bold pb-2 border-b-2 border-gray-300">
                        <div className="w-24">First Name</div>
                        <div className="w-24">Last Name</div>
                        <div className="w-32">Phone</div>
                        <div className="w-40">Email</div>
                        <div className="w-24">Status</div>
                        <div className="w-32">Campaign</div>
                        <div className="w-24">Agent</div>
                        <div className="w-24">Date</div>
                        {fields.map(field => (
                          <div key={field.id} className="w-32 text-blue-700">{field.label}</div>
                        ))}
                      </div>
                      {/* Data Row */}
                      <div className="flex gap-3 text-gray-700">
                        <div className="w-24">John</div>
                        <div className="w-24">Doe</div>
                        <div className="w-32">(555) 123-4567</div>
                        <div className="w-40">john.doe@email.com</div>
                        <div className="w-24">Qualified</div>
                        <div className="w-32">Solar Campaign</div>
                        <div className="w-24">Agent Smith</div>
                        <div className="w-24">12/15/24</div>
                        {fields.map(field => (
                          <div key={field.id} className="w-32 text-blue-600">
                            {field.fieldType === 'dropdown' && field.options ? field.options[0] :
                             field.fieldType === 'currency' ? '$45,000' :
                             field.fieldType === 'number' ? '2500' :
                             field.fieldType === 'date' ? '2024-12-15' :
                             field.fieldType === 'checkbox' ? 'Yes' :
                             'Sample'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>✓ Complete Data:</strong> Exports include all default fields plus all custom fields for comprehensive reporting.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* JSON Output for Testing */}
        {fields.length > 0 && (
          <div className="mt-6 bg-gray-900 text-white rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">JSON Output (for developers):</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(fields, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CustomFieldsBuilderDemo;
