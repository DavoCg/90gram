import { Newspaper } from 'lucide-react-native';
import { Placeholder } from '../../src/components/Placeholder';

export default function NewsScreen() {
  return (
    <Placeholder
      icon={Newspaper}
      title="News"
      subtitle="Vinyl releases, reissues, and label updates will land here."
    />
  );
}
