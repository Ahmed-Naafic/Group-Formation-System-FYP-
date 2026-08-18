import { Badge } from '@/components/ui/badge';

const VARIANT_BY_CATEGORY = { HIGH: 'success', MEDIUM: 'warning', LOW: 'destructive' };

export default function CategoryBadge({ category }) {
  if (!category) return null;
  return <Badge variant={VARIANT_BY_CATEGORY[category] ?? 'secondary'}>{category}</Badge>;
}
