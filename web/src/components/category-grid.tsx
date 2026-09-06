import { categories } from "@/lib/categories";
import { CategoryCard } from "@/components/category-card";

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </div>
  );
}
