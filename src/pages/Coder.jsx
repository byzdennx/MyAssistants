import ConversationView from '../components/ConversationView';
import { useCoderEngine } from '../lib/useCoderEngine';

export default function Coder({ route }) {
  const engine = useCoderEngine({ conversationId: route.segments[1] || null });
  return <ConversationView mode="coder" route={route} engine={engine} showSearch={false} />;
}
