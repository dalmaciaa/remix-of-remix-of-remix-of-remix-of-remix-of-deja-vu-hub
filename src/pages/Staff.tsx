import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Users, Plus, Edit, Trash2, UserX, UserCheck, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole, ROLE_PERMISSIONS } from '@/types/auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StaffStats } from '@/components/staff/StaffStats';

interface StaffMember {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  roles: AppRole[];
}

interface StaffForm {
  username: string;
  password: string;
  full_name: string;
  email: string;
  phone: string;
  roles: AppRole[];
}

const emptyForm: StaffForm = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  roles: []
};

const availableRoles: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'mozo', label: 'Mozo' },
  { value: 'cocina', label: 'Cocina' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'cajero', label: 'Cajero' }
];

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState<StaffForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchStaff = async () => {
    try {
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .order('full_name');

      if (staffError) throw staffError;

      // Fetch roles for each staff member
      const staffWithRoles = await Promise.all(
        (staffData || []).map(async (member) => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('staff_id', member.id);
          
          return {
            ...member,
            roles: (rolesData || []).map(r => r.role as AppRole)
          };
        })
      );

      setStaff(staffWithRoles);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cargar el personal'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async () => {
    if (!formData.username || !formData.password || !formData.full_name || formData.roles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Complete todos los campos obligatorios'
      });
      return;
    }

    try {
      setSaving(true);

      // Create staff member
      const { data: newStaff, error: staffError } = await supabase
        .from('staff')
        .insert({
          username: formData.username,
          password_hash: formData.password,
          full_name: formData.full_name,
          email: formData.email || null,
          phone: formData.phone || null
        })
        .select()
        .single();

      if (staffError) throw staffError;

      // Add roles
      const roleInserts = formData.roles.map(role => ({
        staff_id: newStaff.id,
        role
      }));

      const { error: rolesError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (rolesError) throw rolesError;

      toast({
        title: 'Personal creado',
        description: `${formData.full_name} ha sido agregado correctamente`
      });

      setIsAddDialogOpen(false);
      setFormData(emptyForm);
      fetchStaff();
    } catch (error: any) {
      console.error('Error adding staff:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo crear el usuario'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditStaff = async () => {
    if (!selectedStaff || !formData.full_name || formData.roles.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Complete todos los campos obligatorios'
      });
      return;
    }

    try {
      setSaving(true);

      // Update staff member
      const updateData: any = {
        full_name: formData.full_name,
        email: formData.email || null,
        phone: formData.phone || null
      };

      // Only update password if provided
      if (formData.password) {
        updateData.password_hash = formData.password;
      }

      const { error: staffError } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', selectedStaff.id);

      if (staffError) throw staffError;

      // Delete existing roles and add new ones
      await supabase
        .from('user_roles')
        .delete()
        .eq('staff_id', selectedStaff.id);

      const roleInserts = formData.roles.map(role => ({
        staff_id: selectedStaff.id,
        role
      }));

      const { error: rolesError } = await supabase
        .from('user_roles')
        .insert(roleInserts);

      if (rolesError) throw rolesError;

      toast({
        title: 'Personal actualizado',
        description: `${formData.full_name} ha sido actualizado correctamente`
      });

      setIsEditDialogOpen(false);
      setSelectedStaff(null);
      setFormData(emptyForm);
      fetchStaff();
    } catch (error: any) {
      console.error('Error updating staff:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo actualizar el usuario'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: member.is_active ? 'Usuario desactivado' : 'Usuario activado',
        description: `${member.full_name} ha sido ${member.is_active ? 'desactivado' : 'activado'}`
      });

      fetchStaff();
    } catch (error) {
      console.error('Error toggling staff status:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el estado del usuario'
      });
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedStaff) return;

    try {
      setSaving(true);

      // Check if user has associated sales
      const { data: salesData } = await supabase
        .from('sales')
        .select('id')
        .eq('staff_id', selectedStaff.id)
        .limit(1);

      if (salesData && salesData.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'Este usuario tiene ventas asociadas. Desactívelo en su lugar.'
        });
        return;
      }

      // Check if user has kitchen orders
      const { data: ordersData } = await supabase
        .from('kitchen_orders')
        .select('id')
        .eq('staff_id', selectedStaff.id)
        .limit(1);

      if (ordersData && ordersData.length > 0) {
        toast({
          variant: 'destructive',
          title: 'No se puede eliminar',
          description: 'Este usuario tiene pedidos asociados. Desactívelo en su lugar.'
        });
        return;
      }

      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', selectedStaff.id);

      if (error) throw error;

      toast({
        title: 'Personal eliminado',
        description: `${selectedStaff.full_name} ha sido eliminado`
      });

      setIsDeleteDialogOpen(false);
      setSelectedStaff(null);
      fetchStaff();
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el usuario'
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (member: StaffMember) => {
    setSelectedStaff(member);
    setFormData({
      username: member.username,
      password: '',
      full_name: member.full_name,
      email: member.email || '',
      phone: member.phone || '',
      roles: member.roles
    });
    setIsEditDialogOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader 
        title="Gestión de Personal" 
        description="Administra usuarios y sus permisos"
      >
        <Button onClick={() => { setFormData(emptyForm); setIsAddDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </PageHeader>

      <Tabs defaultValue="stats" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Rendimiento
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <StaffStats />
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(member => (
                    <TableRow key={member.id} className={!member.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{member.username}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map(role => (
                            <Badge key={role} variant="secondary">
                              {ROLE_PERMISSIONS[role].label}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.is_active ? (
                          <Badge className="bg-green-500"><UserCheck className="w-3 h-3 mr-1" /> Activo</Badge>
                        ) : (
                          <Badge variant="destructive"><UserX className="w-3 h-3 mr-1" /> Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.email && <div>{member.email}</div>}
                        {member.phone && <div>{member.phone}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(member)}
                          >
                            {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedStaff(member); setIsDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <Label>Usuario *</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="juanperez"
              />
            </div>
            <div>
              <Label>Contraseña *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="juan@ejemplo.com"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+591 12345678"
              />
            </div>
            <div>
              <Label>Roles *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableRoles.map(role => (
                  <Badge
                    key={role.value}
                    variant={formData.roles.includes(role.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRole(role.value)}
                  >
                    {role.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddStaff} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre completo *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Usuario</Label>
              <Input value={formData.username} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Nueva contraseña (dejar vacío para mantener)</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Roles *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {availableRoles.map(role => (
                  <Badge
                    key={role.value}
                    variant={formData.roles.includes(role.value) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRole(role.value)}
                  >
                    {role.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditStaff} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el usuario tiene ventas o pedidos asociados, no podrá ser eliminado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
