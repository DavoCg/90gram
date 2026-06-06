import { Flame } from 'lucide-react-native';
import { Placeholder } from '../../src/components/Placeholder';

export default function HotScreen() {
  return (
    <Placeholder
      icon={Flame}
      title="Hot"
      subtitle="Trending vinyl releases, reissues, and label updates will land here."
    />
  );
}
