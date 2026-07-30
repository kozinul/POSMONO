import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../@shared/services/api';
import Swal from 'sweetalert2';

interface Template {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  paper: { type: string };
  isActive: boolean;
}

async function fetchTemplates(): Promise<Template[]> {
  const res = await api.get('/templates');
  return res.data.data;
}

async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/templates/${id}`);
}

async function publishTemplate(id: string): Promise<any> {
  const res = await api.post(`/templates/${id}/publish`);
  return res.data.data;
}

export default function TemplateListPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    documentType: 'receipt',
    paperType: 'thermal80',
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/templates', data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      api.put(`/templates/${payload.id}`, payload.data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowModal(false);
      setEditingTemplate(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', documentType: 'receipt', paperType: 'thermal80' });
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (t: Template) => {
    setEditingTemplate(t);
    setFormData({
      name: t.name,
      description: t.description ?? '',
      documentType: t.documentType,
      paperType: t.paper.type,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    const paperType = formData.paperType;
    const isThermal = paperType === 'thermal58' || paperType === 'thermal80';
    const payload = {
      ...formData,
      paper: {
        type: paperType,
        width: isThermal ? (paperType === 'thermal58' ? 58 : 80) : paperType === 'a4-landscape' ? 297 : 210,
        height: isThermal ? 'auto' : 297,
        margin: { top: 2, right: 3, bottom: 2, left: 3 },
      },
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDuplicate = async (id: string) => {
    await api.post(`/templates/${id}/duplicate`);
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const handleExport = async (id: string) => {
    const res = await api.post(`/templates/${id}/export`, null, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Delete Template',
      text: 'Are you sure you want to delete this template?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <button onClick={openCreateModal} className="blue-primary text-white px-4 py-2 rounded-lg font-medium hover:opacity-90">
          + New Template
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">No templates yet. Create one to get started.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">{t.name}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {t.isActive ? 'Active' : 'Draft'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2">{t.description ?? 'No description'}</p>
              <div className="flex gap-2 text-xs text-gray-400 mb-3">
                <span>{t.documentType}</span>
                <span>•</span>
                <span>{t.paper.type}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a href={`/templates/${t.id}/designer`} className="blue-primary text-white px-3 py-1.5 rounded text-sm font-medium hover:opacity-90">Edit</a>
                <button onClick={() => handleDuplicate(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200">Duplicate</button>
                <button onClick={() => handleExport(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200">Export</button>
                {t.isActive ? (
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm font-medium">Published</span>
                ) : (
                  <button onClick={() => publishMutation.mutate(t.id)} className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm font-medium hover:opacity-90">Publish</button>
                )}
                <button onClick={() => handleDelete(t.id)} className="px-3 py-1.5 bg-gray-100 text-red-600 rounded text-sm font-medium hover:bg-red-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select value={formData.documentType} onChange={(e) => setFormData({ ...formData, documentType: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                  <option value="receipt">Receipt</option>
                  <option value="invoice">Invoice</option>
                  <option value="kot">KOT</option>
                  <option value="label">Label</option>
                  <option value="report">Report</option>
                  <option value="slip">Slip</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paper Type</label>
                <select value={formData.paperType} onChange={(e) => setFormData({ ...formData, paperType: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                  <option value="thermal58">Thermal 58mm</option>
                  <option value="thermal80">Thermal 80mm</option>
                  <option value="a4-portrait">A4 Portrait</option>
                  <option value="a4-landscape">A4 Landscape</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSubmit} disabled={!formData.name} className="px-4 py-2 blue-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50">{editingTemplate ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
