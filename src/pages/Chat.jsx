import ConversationView from '../components/ConversationView';
import { useChatEngine } from '../lib/useChatEngine';

// Mode obrolan ringan (Nekolabs, langsung dari browser). Permintaan code dialihkan ke halaman Coder.
export default function Chat({ route }) {
  const id = route.segments[1] || null;
  const engine = useChatEngine({ conversationId: id });
  return <ConversationView mode="chat" route={route} engine={engine} showSearch />;
}
