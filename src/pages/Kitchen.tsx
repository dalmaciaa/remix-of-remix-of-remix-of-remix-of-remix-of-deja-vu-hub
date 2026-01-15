import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChefHat, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface KitchenOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
}

interface KitchenOrder {
  id: string;
  sale_id: string | null;
  staff_name: string;
  table_number: string | null;
  notes: string | null;
  status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';
  created_at: string;
  items: KitchenOrderItem[];
}

export default function Kitchen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { roles } = useAuth();
  
  const isAdminRole = roles.includes('admin');
  const isKitchenRole = roles.includes('cocina') || isAdminRole;
  const isMozoRole = roles.includes('mozo') || isAdminRole;

  const fetchOrders = async () => {
    try {
      // Fetch orders that are not 'entregado'
      const { data: ordersData, error: ordersError } = await supabase
        .from('kitchen_orders')
        .select('*')
        .in('status', ['pendiente', 'en_preparacion', 'listo'])
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: items } = await supabase
            .from('kitchen_order_items')
            .select('*')
            .eq('kitchen_order_id', order.id);
          
          return {
            ...order,
            items: items || []
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los pedidos'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrder['status']) => {
    try {
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // If marking as ready, notify waiters
      if (newStatus === 'listo') {
        const order = orders.find(o => o.id === orderId);
        await supabase
          .from('staff_notifications')
          .insert({
            role_target: 'mozo',
            title: '¡Pedido Listo!',
            message: `Mesa ${order?.table_number || 'S/N'} está listo para entregar`,
            type: 'order_ready',
            related_id: orderId,
          });
      }

      toast({
        title: 'Estado actualizado',
        description: `Pedido marcado como "${newStatus.replace('_', ' ')}"`
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el estado'
      });
    }
  };

  const getStatusBadge = (status: KitchenOrder['status']) => {
    switch (status) {
      case 'pendiente':
        return <Badge variant="destructive" className="text-lg px-4 py-1"><AlertCircle className="w-4 h-4 mr-1" /> Pendiente</Badge>;
      case 'en_preparacion':
        return <Badge className="bg-amber-500 text-lg px-4 py-1"><Clock className="w-4 h-4 mr-1" /> En Preparación</Badge>;
      case 'listo':
        return <Badge className="bg-green-500 text-lg px-4 py-1"><CheckCircle className="w-4 h-4 mr-1" /> Listo</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const pendingOrders = orders.filter(o => o.status === 'pendiente');
  const inProgressOrders = orders.filter(o => o.status === 'en_preparacion');
  const readyOrders = orders.filter(o => o.status === 'listo');

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
        title="Pedidos de Cocina" 
        description="Gestión de pedidos en tiempo real"
      />

      {orders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No hay pedidos pendientes</h3>
            <p className="text-muted-foreground">Los nuevos pedidos aparecerán aquí automáticamente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="w-6 h-6" />
              Pendientes ({pendingOrders.length})
            </h2>
            {pendingOrders.map(order => (
              <Card key={order.id} className="border-destructive/50 border-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        {order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{order.staff_name} • {formatTime(order.created_at)}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {order.items.map(item => (
                      <li key={item.id} className="text-xl font-medium flex justify-between">
                        <span>{item.quantity}x {item.product_name}</span>
                        {item.notes && <span className="text-sm text-muted-foreground">({item.notes})</span>}
                      </li>
                    ))}
                  </ul>
                  {order.notes && (
                    <p className="text-sm bg-muted p-2 rounded mb-4">📝 {order.notes}</p>
                  )}
                  {isKitchenRole && (
                    <Button 
                      className="w-full h-14 text-lg"
                      onClick={() => updateOrderStatus(order.id, 'en_preparacion')}
                    >
                      <Clock className="w-5 h-5 mr-2" />
                      Comenzar Preparación
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* In Progress Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-amber-500">
              <Clock className="w-6 h-6" />
              En Preparación ({inProgressOrders.length})
            </h2>
            {inProgressOrders.map(order => (
              <Card key={order.id} className="border-amber-500/50 border-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        {order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{order.staff_name} • {formatTime(order.created_at)}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {order.items.map(item => (
                      <li key={item.id} className="text-xl font-medium flex justify-between">
                        <span>{item.quantity}x {item.product_name}</span>
                        {item.notes && <span className="text-sm text-muted-foreground">({item.notes})</span>}
                      </li>
                    ))}
                  </ul>
                  {order.notes && (
                    <p className="text-sm bg-muted p-2 rounded mb-4">📝 {order.notes}</p>
                  )}
                  {isKitchenRole && (
                    <Button 
                      className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                      onClick={() => updateOrderStatus(order.id, 'listo')}
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Marcar como Listo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ready Column */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-green-500">
              <CheckCircle className="w-6 h-6" />
              Listos para Entregar ({readyOrders.length})
            </h2>
            {readyOrders.map(order => (
              <Card key={order.id} className="border-green-500/50 border-2">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">
                        {order.table_number ? `Mesa ${order.table_number}` : 'Sin mesa'}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{order.staff_name} • {formatTime(order.created_at)}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {order.items.map(item => (
                      <li key={item.id} className="text-xl font-medium flex justify-between">
                        <span>{item.quantity}x {item.product_name}</span>
                        {item.notes && <span className="text-sm text-muted-foreground">({item.notes})</span>}
                      </li>
                    ))}
                  </ul>
                  {order.notes && (
                    <p className="text-sm bg-muted p-2 rounded mb-4">📝 {order.notes}</p>
                  )}
                  {(isMozoRole || isKitchenRole) && (
                    <Button 
                      className="w-full h-14 text-lg"
                      variant="outline"
                      onClick={() => updateOrderStatus(order.id, 'entregado')}
                    >
                      Marcar como Entregado
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
