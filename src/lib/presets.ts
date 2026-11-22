import type { PresetItem } from '../types/visualizer';

export const SAMPLE_ROOM_ASSET = {
  name: 'sunlit-scandinavian-living-room.jpg',
  label: 'Sunlit Living Room',
  url: '/src/assets/images/sample_living_room_1795335115158.jpg',
} as const;

export const PRESET_CATALOG: PresetItem[] = [
  {
    id: 'modern-linen-sofa',
    name: 'Modern Linen Sofa',
    category: 'Furniture',
    description: 'Three-seater oatmeal linen sofa with natural oak legs',
    thumbnailUrl: '/src/assets/images/preset_linen_sofa_1795335116513.jpg',
    imageUrl: '/src/assets/images/preset_linen_sofa_1795335116513.jpg',
  },
  {
    id: 'midcentury-accent-chair',
    name: 'Walnut Lounge Chair',
    category: 'Furniture',
    description: 'Mid-century walnut frame with cognac leather cushions',
    thumbnailUrl: '/src/assets/images/preset_accent_chair_1795335114427.jpg',
    imageUrl: '/src/assets/images/preset_accent_chair_1795335114427.jpg',
  },
  {
    id: 'oak-coffee-table',
    name: 'Fluted Oak Table',
    category: 'Furniture',
    description: 'Round solid white oak coffee table with fluted legs',
    thumbnailUrl: '/src/assets/images/preset_oak_table_1795335115467.jpg',
    imageUrl: '/src/assets/images/preset_oak_table_1795335115467.jpg',
  },
  {
    id: 'brass-arc-lamp',
    name: 'Brass Arc Floor Lamp',
    category: 'Lighting',
    description: 'Brushed brass floor lamp with Carrara marble base',
    thumbnailUrl: '/src/assets/images/preset_brass_lamp_1795335113824.jpg',
    imageUrl: '/src/assets/images/preset_brass_lamp_1795335113824.jpg',
  },
  {
    id: 'potted-monstera',
    name: 'Potted Monstera',
    category: 'Plants',
    description: 'Monstera deliciosa in a fluted matte stoneware planter',
    thumbnailUrl: '/src/assets/images/preset_monstera_plant_1795335115189.jpg',
    imageUrl: '/src/assets/images/preset_monstera_plant_1795335115189.jpg',
  },
  {
    id: 'framed-abstract-art',
    name: 'Framed Abstract Art',
    category: 'Wall Art',
    description: 'Minimalist indigo and stone canvas in an oak gallery frame',
    thumbnailUrl: '/src/assets/images/preset_abstract_art_1795335115534.jpg',
    imageUrl: '/src/assets/images/preset_abstract_art_1795335115534.jpg',
  },
  {
    id: 'espresso-machine',
    name: 'Espresso Machine',
    category: 'Appliances',
    description: 'Brushed stainless Italian espresso machine with walnut accents',
    thumbnailUrl: '/src/assets/images/preset_espresso_machine_1795335115289.jpg',
    imageUrl: '/src/assets/images/preset_espresso_machine_1795335115289.jpg',
  },
  {
    id: 'ceramic-vase',
    name: 'Sculptural Vase',
    category: 'Decor',
    description: 'Handmade matte off-white stoneware vessel with curved handles',
    thumbnailUrl: '/src/assets/images/preset_ceramic_vase_1795335115799.jpg',
    imageUrl: '/src/assets/images/preset_ceramic_vase_1795335115799.jpg',
  },
];

export const PRESET_CATEGORIES = [
  'All',
  'Furniture',
  'Lighting',
  'Plants',
  'Wall Art',
  'Appliances',
  'Decor',
] as const;

export type PresetCategoryFilter = (typeof PRESET_CATEGORIES)[number];
