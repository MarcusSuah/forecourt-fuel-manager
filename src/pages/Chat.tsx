import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageCircle, Send, Trash2, Video, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomBranch, setNewRoomBranch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === "admin" || user?.role === "supervisor";

  const { data: rooms } = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_rooms").select("*, branches(name)").eq("is_active", true).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["chat-messages", selectedRoom],
    enabled: !!selectedRoom,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*, profiles:sender_id(full_name, avatar_url)")
        .eq("room_id", selectedRoom!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-chat"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name");
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!selectedRoom) return;
    const channel = supabase
      .channel(`chat-${selectedRoom}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${selectedRoom}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedRoom] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRoom, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("chat_messages").insert({
        room_id: selectedRoom!,
        sender_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedRoom] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedRoom] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("chat_rooms").insert({
        name: newRoomName,
        branch_id: newRoomBranch || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chat room created");
      setCreateDialogOpen(false);
      setNewRoomName("");
      setNewRoomBranch("");
      queryClient.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedRoom) return;
    sendMutation.mutate(message.trim());
  };

  const getSenderName = (senderId: string) => {
    const profile = profiles?.find(p => p.user_id === senderId);
    return profile?.full_name || "Unknown";
  };

  const openJitsi = () => {
    if (!selectedRoom || !rooms) return;
    const room = rooms.find(r => r.id === selectedRoom);
    const roomSlug = (room?.name || "fms-meeting").replace(/\s+/g, "-").toLowerCase();
    window.open(`https://meet.jit.si/fms-${roomSlug}`, "_blank", "noopener");
  };

  return (
    <AppLayout title="Team Chat" subtitle="Communicate across branches with your team">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
        {/* Room List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Channels</CardTitle>
              {isAdmin && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Chat Room</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Room Name</Label>
                        <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. General, Branch Updates" />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch (optional)</Label>
                        <Select value={newRoomBranch} onValueChange={setNewRoomBranch}>
                          <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_branches">All Branches</SelectItem>
                            {branches?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={() => createRoomMutation.mutate()} disabled={!newRoomName.trim()} className="w-full">Create Room</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-1 overflow-y-auto max-h-[calc(100vh-320px)]">
            {rooms?.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedRoom === room.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{room.name}</span>
                </div>
                {(room.branches as any)?.name && (
                  <span className="text-[10px] text-muted-foreground ml-6">{(room.branches as any).name}</span>
                )}
              </button>
            ))}
            {(!rooms || rooms.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No chat rooms yet</p>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-3 flex flex-col">
          {selectedRoom ? (
            <>
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    {rooms?.find(r => r.id === selectedRoom)?.name}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={openJitsi}>
                    <Video className="h-4 w-4 mr-1" /> Video Call
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
                {messages?.map(msg => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[70%] rounded-lg px-3 py-2", isOwn ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        {!isOwn && (
                          <p className="text-[10px] font-medium mb-0.5 opacity-70">{getSenderName(msg.sender_id)}</p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {isOwn && (
                            <button onClick={() => deleteMutation.mutate(msg.id)} className="ml-1 opacity-60 hover:opacity-100">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </CardContent>
              <div className="p-3 border-t flex-shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!message.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Select a chat room</p>
                <p className="text-sm text-muted-foreground">Choose a channel to start chatting</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
