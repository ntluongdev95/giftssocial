// Curated breed catalog for species WITHOUT a public photo API.
// Dogs use Dog CEO API. Cats use The Cat API. Everything else lives here.
//
// Photos are unsplash.com direct-CDN URLs — free, real, no API key needed.
// Each breed has a stable id, a display label, a 1-line "personality"
// hint, and a single representative photo URL.

export type CatalogBreed = {
  id: string;
  label: string;
  personality: string;
  image_url: string;
};

const u = (id: string) => `https://images.unsplash.com/${id}?w=600&auto=format&fit=crop&q=70`;

export const BOND_BREEDS_CATALOG: Record<string, CatalogBreed[]> = {
  // 🐇 Rabbit
  '🐇': [
    { id: 'holland-lop',  label: 'Holland Lop',  personality: 'Floppy ears, gentle', image_url: u('photo-1535241749838-299277b6305f') },
    { id: 'mini-rex',     label: 'Mini Rex',     personality: 'Velvety soft',         image_url: u('photo-1452857297128-d9c29adba80b') },
    { id: 'lionhead',     label: 'Lionhead',     personality: 'Mane of fluff',         image_url: u('photo-1591382386627-349b692688ff') },
    { id: 'flemish',      label: 'Flemish Giant',personality: 'Giant cuddler',         image_url: u('photo-1606755456206-b25206cde27e') },
  ],

  // 🦊 Fox
  '🦊': [
    { id: 'red-fox',   label: 'Red Fox',   personality: 'Classic sly',     image_url: u('photo-1474511320723-9a56873867b5') },
    { id: 'arctic',    label: 'Arctic Fox',personality: 'Snow ghost',      image_url: u('photo-1605559911083-aa00890f5e6e') },
    { id: 'fennec',    label: 'Fennec',    personality: 'Tiny + huge ears',image_url: u('photo-1583425423320-c4d1c1de9ad4') },
    { id: 'silver',    label: 'Silver Fox',personality: 'Rare beauty',     image_url: u('photo-1516934024742-b461fba47600') },
  ],

  // 🦥 Sloth
  '🦥': [
    { id: 'two-toed',  label: 'Two-toed',  personality: 'Slow and chill',  image_url: u('photo-1597926006440-bc36a4ab02ec') },
    { id: 'three-toed',label: 'Three-toed',personality: 'Smile permanently',image_url: u('photo-1576858574144-9ae1ebcf5ae5') },
    { id: 'pygmy',     label: 'Pygmy',     personality: 'Tiny treasure',    image_url: u('photo-1626202604293-4b9f8a31e7d5') },
  ],

  // 🐧 Penguin
  '🐧': [
    { id: 'emperor',  label: 'Emperor',  personality: 'Royal waddle',     image_url: u('photo-1551739440-5dd934d3a94a') },
    { id: 'king',     label: 'King',     personality: 'Tall and orange',  image_url: u('photo-1542628039-3eba89e91dc4') },
    { id: 'chinstrap',label: 'Chinstrap',personality: 'Black helmet',     image_url: u('photo-1591608971362-f08b2a75731a') },
    { id: 'gentoo',   label: 'Gentoo',   personality: 'Fast swimmer',     image_url: u('photo-1517783999520-f068d7431a60') },
  ],

  // 🦦 Otter
  '🦦': [
    { id: 'sea',       label: 'Sea Otter',     personality: 'Holds hands while sleeping', image_url: u('photo-1635436415049-1bc3a64dfbe9') },
    { id: 'river',     label: 'River Otter',   personality: 'Playful splasher',    image_url: u('photo-1571115764595-644a1f56a55c') },
    { id: 'asian',     label: 'Asian Small-claw',personality: 'Talkative',          image_url: u('photo-1614525090837-91f49ddf9d0a') },
    { id: 'giant',     label: 'Giant Otter',   personality: 'Family pod',          image_url: u('photo-1606214174585-fe31582dc6ee') },
  ],

  // 🐢 Turtle
  '🐢': [
    { id: 'sea',      label: 'Sea Turtle',   personality: 'Ocean wanderer',    image_url: u('photo-1518709268805-4e9042af9f23') },
    { id: 'green',    label: 'Green',        personality: 'Tropical reef pal', image_url: u('photo-1438565434616-3ef039228b15') },
    { id: 'hawksbill',label: 'Hawksbill',    personality: 'Sharp beak',        image_url: u('photo-1591025207163-942350e47db2') },
    { id: 'land',     label: 'Tortoise',     personality: 'Slow and steady',   image_url: u('photo-1437622368342-7a3d73a34c8f') },
  ],

  // 🦝 Raccoon
  '🦝': [
    { id: 'common',  label: 'Common',  personality: 'Trash panda',          image_url: u('photo-1530268729831-4b0b9e170218') },
    { id: 'baby',    label: 'Kit',     personality: 'Curious explorer',      image_url: u('photo-1606582812960-43dc7fa5957b') },
    { id: 'masked',  label: 'Masked',  personality: 'Burglar chic',         image_url: u('photo-1574482620811-1aa16ffe3c82') },
  ],

  // 🐉 Dragon — mythical, AI-generated style photos
  '🐉': [
    { id: 'fire',   label: 'Fire Dragon',  personality: 'Burning skies',     image_url: u('photo-1655720033654-a4239dd42b10') },
    { id: 'ice',    label: 'Ice Dragon',   personality: 'Frozen fury',       image_url: u('photo-1605478579063-c7a47a4be1e1') },
    { id: 'forest', label: 'Forest Dragon',personality: 'Mossy guardian',    image_url: u('photo-1518709268805-4e9042af9f23') },
    { id: 'dark',   label: 'Shadow Dragon',personality: 'Moonlit secret',    image_url: u('photo-1604675068228-b7c2c1a3e7b1') },
  ],

  // 🦄 Unicorn
  '🦄': [
    { id: 'rainbow',  label: 'Rainbow',   personality: 'Spectrum mane',     image_url: u('photo-1573164574001-518958d9baa2') },
    { id: 'classic',  label: 'Classic',   personality: 'Pure white horn',   image_url: u('photo-1539362904257-1ce4b6e75c1d') },
    { id: 'celestial',label: 'Celestial', personality: 'Starlit aura',      image_url: u('photo-1604675068228-b7c2c1a3e7b1') },
    { id: 'rose',     label: 'Rose Gold', personality: 'Soft pastel',       image_url: u('photo-1607604276583-eef5d076aa5f') },
  ],

  // 🦋 Phoenix (using butterfly photos as visual stand-in for the mythical phoenix)
  '🦋': [
    { id: 'sunfire',   label: 'Sunfire',    personality: 'Wings of flame',    image_url: u('photo-1567604130959-7ea7ab2a7ef9') },
    { id: 'amethyst',  label: 'Amethyst',   personality: 'Purple shimmer',    image_url: u('photo-1559128150-32c66432b1ed') },
    { id: 'celestial', label: 'Celestial',  personality: 'Starlight wings',   image_url: u('photo-1592769606457-2f4f12bbcf0e') },
    { id: 'monarch',   label: 'Monarch',    personality: 'Royal orange',      image_url: u('photo-1452284889395-fc6acec55976') },
  ],
};
