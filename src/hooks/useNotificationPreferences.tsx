import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  mentions: boolean;
  friend_requests: boolean;
  messages: boolean;
  trending: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  likes: true,
  comments: true,
  mentions: true,
  friend_requests: true,
  messages: true,
  trending: true,
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences({
        likes: data.likes,
        comments: data.comments,
        mentions: data.mentions,
        friend_requests: data.friend_requests,
        messages: data.messages,
        trending: data.trending,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;
    setSaving(true);

    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);

    // Upsert
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...newPrefs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      // Revert
      setPreferences(preferences);
    }
    setSaving(false);
  }, [user, preferences]);

  return { preferences, loading, saving, updatePreference };
}
