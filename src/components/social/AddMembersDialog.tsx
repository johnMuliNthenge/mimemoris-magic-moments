import { useState } from 'react';
import { UserPlus, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFriends } from '@/hooks/useFriends';
import { toast } from 'sonner';

interface AddMembersDialogProps {
  groupId: string;
  existingMemberIds: string[];
  onAddMember: (userId: string) => Promise<{ error: string | null }>;
}

export function AddMembersDialog({ groupId, existingMemberIds, onAddMember }: AddMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { friends, loading } = useFriends();

  // Filter out friends who are already members
  const availableFriends = friends.filter(f => !existingMemberIds.includes(f.user_id));

  const handleAddMember = async (userId: string) => {
    setAddingId(userId);
    const { error } = await onAddMember(userId);
    setAddingId(null);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Member added!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Friends
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Friends to Group</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : availableFriends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No friends available to add</p>
              <p className="text-sm mt-1">All your friends are already in this group</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {availableFriends.map(friend => (
                <div 
                  key={friend.user_id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback>
                        {friend.full_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium">{friend.full_name || 'Unknown'}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAddMember(friend.user_id)}
                    disabled={addingId === friend.user_id}
                  >
                    {addingId === friend.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
