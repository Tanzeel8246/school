import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { SchoolFormModal, type School } from './SchoolFormModal';

export function SchoolsList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  async function loadSchools() {
    try {
      setLoading(true);
      const res = await api.get<{ data: School[] }>('/schools');
      // Assuming the backend returns { data: [...] } for list queries
      setSchools(res.data.data || []);
    } catch (err) {
      console.error('Failed to load schools', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchools();
  }, []);

  function handleCreate() {
    setEditingSchool(null);
    setModalOpen(true);
  }

  function handleEdit(school: School) {
    setEditingSchool(school);
    setModalOpen(true);
  }

  async function handleDelete(school: School) {
    if (!confirm(`Are you sure you want to delete ${school.name}? This will remove the entire tenant and all its data! (Soft delete)`)) {
      return;
    }
    try {
      await api.del(`/schools/${school.id}`);
      loadSchools();
    } catch (err) {
      alert('Failed to delete school');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Registered Schools</h2>
          <p className="text-sm text-muted-foreground">Manage all tenant schools in the system.</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add School
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
          <div className="h-20 rounded-lg bg-muted" />
        </div>
      ) : schools.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed py-12 text-center text-muted-foreground">
          No schools found.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH>Created At</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {schools.map((school) => (
              <TR key={school.id}>
                <TD className="font-medium">{school.code}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    {school.logoUrl ? (
                      <img src={school.logoUrl} alt="" className="h-8 w-8 rounded bg-muted object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                    <span>{school.name}</span>
                  </div>
                </TD>
                <TD>
                  <span className={`px-2 py-1 text-xs rounded-full uppercase font-medium ${
                    school.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 
                    school.subscription_status === 'trial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {school.subscription_status || 'Unknown'}
                  </span>
                </TD>
                <TD>{new Date(school.createdAt).toLocaleDateString()}</TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {school.subscription_status === 'canceled' ? (
                      <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={async () => {
                        await api.post(`/schools/${school.id}/reactivate`, {});
                        loadSchools();
                      }}>
                        Activate
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                        if (confirm(`De-activate ${school.name}? They will lose access immediately.`)) {
                          await api.post(`/schools/${school.id}/cancel`, {});
                          loadSchools();
                        }
                      }}>
                        De-activate
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(school)} aria-label="Edit">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(school)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <SchoolFormModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSaved={loadSchools} 
        school={editingSchool} 
      />
    </div>
  );
}
