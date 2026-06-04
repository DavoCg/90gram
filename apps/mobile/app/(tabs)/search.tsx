import { Search } from 'lucide-react-native';
import { Placeholder } from '../../src/components/Placeholder';

export default function SearchScreen() {
  return (
    <Placeholder
      icon={Search}
      title="Search"
      subtitle="Find records by title, artist, or label."
    />
  );
}
