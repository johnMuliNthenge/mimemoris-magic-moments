import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Cloud, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, lastSynced, manualSync } = useOfflineSync();

  const showBanner = !isOnline || pendingCount > 0;

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
                : 'bg-primary/10 text-foreground border-b border-primary/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {!isOnline ? (
                <>
                  <WifiOff className="w-4 h-4 text-warning" />
                  <span>You're offline — memories will sync when reconnected</span>
                </>
              ) : isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Syncing {pendingCount} memory{pendingCount !== 1 ? 'ies' : ''}...</span>
                </>
              ) : pendingCount > 0 ? (
                <>
                  <Cloud className="w-4 h-4 text-primary" />
                  <span>{pendingCount} memory{pendingCount !== 1 ? 'ies' : ''} waiting to sync</span>
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
