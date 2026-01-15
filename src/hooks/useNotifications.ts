import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AppRole } from '@/types/auth';

interface Notification {
  id: string;
  staff_id: string | null;
  role_target: AppRole | null;
  title: string;
  message: string;
  type: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { currentStaff, roles } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!currentStaff) return;

    // Fetch notifications for this staff or their roles
    const { data, error } = await supabase
      .from('staff_notifications')
      .select('*')
      .or(`staff_id.eq.${currentStaff.id},role_target.in.(${roles.join(',')})`)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.length || 0);
  }, [currentStaff, roles]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('staff_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!currentStaff || notifications.length === 0) return;

    const ids = notifications.map(n => n.id);
    const { error } = await supabase
      .from('staff_notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (!currentStaff) return;

    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('staff-notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'staff_notifications'
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Check if this notification is for us
          const isForMe = newNotification.staff_id === currentStaff.id || 
            (newNotification.role_target && roles.includes(newNotification.role_target));
          
          if (isForMe) {
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Show toast notification
            toast.info(newNotification.title, {
              description: newNotification.message,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStaff, roles, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
