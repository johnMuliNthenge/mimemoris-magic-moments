import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Cloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSynced, manualSync, offlineMemories } = useOfflineSync();

  const failedCount = offlineMemories.filter((m) => m.sync_status === 'failed').length;
  const conflictCount = offlineMemories.filter((m) => m.sync_status === 'conflict').length;
  const showBanner = !isOnline || pendingCount > 0 || failedCount > 0 || conflictCount > 0;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div
            className={`px-4 py-2 flex items-center justify-between text-sm ${
              !isOnline
                ? 'bg-warning/15 text-warning-foreground border-b border-warning/20'
                : conflictCount > 0
                ? 'bg-warning/10 text-foreground border-b border-warning/20'
                : failedCount > 0
                ? 'bg-destructive/10 text-foreground border-b border-destructive/20'
                : 'bg-primary/10 text-foreground border-b border-primary/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-warning" />
                  <span>You're offline — memories will sync when reconnected</span>
                  {pendingCount > 0 && (
                    <span className="text-xs bg-warning/20 px-2 py-0.5 rounded-full">
                      {pendingCount} queued
                    </span>
                  )}
                </>
              ) : isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...</span>
                </>
              ) : conflictCount > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span>{conflictCount} conflict{conflictCount !== 1 ? 's' : ''} need resolution</span>
                </>
              ) : failedCount > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span>{failedCount} failed — will retry automatically</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <Cloud className="w-4 h-4 text-primary" />
                  <span>{pendingCount} item{pendingCount !== 1 ? 's' : ''} waiting to sync</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>All synced</span>
                </>
              )}
            </div>

            {isOnline && pendingCount > 0 && !isSyncing && (
              <Button variant="ghost" size="sm" onClick={manualSync} className="h-7 text-xs">
                Sync now
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
