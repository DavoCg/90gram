import { Heart } from 'lucide-react-native';
import { Placeholder } from '../../src/components/Placeholder';

export default function FavoritesScreen() {
  return (
    <Placeholder
      icon={Heart}
      title="Favorites"
      subtitle="Records you save will show up here."
    />
  );
}
