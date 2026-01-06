import { useState } from 'react';
import { Link, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useGroupChat } from '@/hooks/useGroupChat';
import { toast } from 'sonner';

interface JoinGroupDialogProps {
  onGroupJoined?: (groupId: string) => void;
}

export function JoinGroupDialog({ onGroupJoined }: JoinGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const { joinGroupByCode } = useGroupChat();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    // Extract code from URL if pasted
    let code = inviteCode.trim();
    if (code.includes('/join-group/')) {
      code = code.split('/join-group/').pop() || code;
    }

    setJoining(true);
    const result = await joinGroupByCode(code);
    setJoining(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.groupId) {
      toast.success('Joined group successfully!');
      setInviteCode('');
      setOpen(false);
      onGroupJoined?.(result.groupId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link className="w-4 h-4" />
          Join Group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Invite Code or Link</Label>
            <Input
              id="code"
              placeholder="Paste invite link or code..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can paste the full invite link or just the code
            </p>
          </div>
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Joining...
              </>
            ) : (
              'Join Group'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
