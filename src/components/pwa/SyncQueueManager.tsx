import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  Loader2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOfflineSync, type OfflineStats } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pending', variant: 'secondary' },
    syncing: { label: 'Syncing', variant: 'default' },
    failed: { label: 'Failed', variant: 'destructive' },
    conflict: { label: 'Conflict', variant: 'outline' },
  };
  const c = config[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={c.variant} className="text-xs">{c.label}</Badge>;
}

function StatsCard({ stats }: { stats: OfflineStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <Cloud className="w-4 h-4 text-primary" />
        <div>
          <p className="font-medium">{stats.pendingMemories}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <div>
          <p className="font-medium">{stats.failedMemories}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <CheckCircle className="w-4 h-4 text-success" />
        <div>
          <p className="font-medium">{stats.cachedMemories}</p>
          <p className="text-xs text-muted-foreground">Cached</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
        <HardDrive className="w-4 h-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-xs">{stats.totalStorageEstimate}</p>
          <p className="text-xs text-muted-foreground">Storage</p>
        </div>
      </div>
    </div>
  );
}

export function SyncQueueManager() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSynced,
    manualSync,
    offlineMemories,
    stats,
    discardOfflineMemory,
    resolveConflict,
  } = useOfflineSync();

  const [expanded, setExpanded] = useState(false);

  const failedMemories = offlineMemories.filter((m) => m.sync_status === 'failed');
  const conflictMemories = offlineMemories.filter((m) => m.sync_status === 'conflict');
  const pendingMemories = offlineMemories.filter((m) => m.sync_status === 'pending' || m.sync_status === 'syncing');

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {isOnline ? (
              <Cloud className="w-5 h-5 text-success" />
            ) : (
              <CloudOff className="w-5 h-5 text-warning" />
            )}
            Sync Queue
          </CardTitle>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {lastSynced && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(lastSynced).toLocaleString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={manualSync}
            disabled={isSyncing || !isOnline || pendingCount === 0}
            className="gap-2"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
          {!isOnline && (
            <Badge variant="outline" className="text-warning border-warning/30">
              <CloudOff className="w-3 h-3 mr-1" />
              Offline
            </Badge>
          )}
        </div>

        {/* Stats */}
        {stats && <StatsCard stats={stats} />}

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-3"
            >
              {/* Conflicts */}
              {conflictMemories.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1 text-warning">
                    <AlertTriangle className="w-4 h-4" />
                    Conflicts ({conflictMemories.length})
                  </h4>
                  {conflictMemories.map((m) => (
                    <div key={m.id} className="p-3 rounded-lg border border-warning/30 bg-warning/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">
                          {m.title || `${m.memory_type} memory`}
                        </span>
                        <StatusBadge status={m.sync_status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{m.last_error}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => resolveConflict(m.id, 'force')}
                        >
                          Keep Both
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-destructive"
                          onClick={() => resolveConflict(m.id, 'discard')}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Discard Local
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Failed */}
              {failedMemories.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">
                    Failed ({failedMemories.length})
                  </h4>
                  {failedMemories.map((m) => (
                    <div key={m.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">
                          {m.title || `${m.memory_type} memory`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Retry {m.retry_count}/5
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => discardOfflineMemory(m.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{m.last_error}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending */}
              {pendingMemories.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Queued ({pendingMemories.length})
                  </h4>
                  {pendingMemories.map((m) => (
                    <div key={m.id} className="p-2 rounded-lg border border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={m.sync_status} />
                        <span className="text-sm truncate">
                          {m.title || `${m.memory_type} memory`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {offlineMemories.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
                  All memories are synced
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
