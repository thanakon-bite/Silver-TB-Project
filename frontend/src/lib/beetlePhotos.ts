/**
 * Openly licensed beetle photos from Wikimedia Commons, linked (not copied) and credited where shown,
 * as their licences require. Swap in the shop's own photos by changing `src` and the credit.
 */
export interface BeetlePhoto {
  src: string;
  /** What the photo shows, for the alt text, in Thai and English. */
  alt: { th: string; en: string };
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

const commons = (file: string, width = 1600) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
const page = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;

const LICENSES: Record<string, string> = {
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
};

const photo = (file: string, author: string, license: string, alt: BeetlePhoto['alt'], width?: number): BeetlePhoto => ({
  src: commons(file, width),
  alt,
  author,
  license,
  licenseUrl: LICENSES[license],
  sourceUrl: page(file),
});

export const PHOTOS = {
  rhino: photo('Xylotrupes socrates (Siamese rhinoceros beetle).jpg', 'Basile Morin', 'CC BY-SA 4.0', {
    th: 'ด้วงกว่างชนตัวผู้เกาะใบตอง',
    en: 'A male Siamese rhinoceros beetle on a banana leaf',
  }),
  flower: photo('Flamboyant Flower Beetle.jpg', 'Ltshears', 'CC BY 3.0', {
    th: 'ด้วงกุหลาบสีสดกำลังกินผลไม้บนขอนไม้',
    en: 'Brightly coloured flower beetles feeding on fruit on a log',
  }),
  stagLog: photo('Lucanus Cervus male sideview.jpg', 'Kazimour', 'CC BY-SA 4.0', {
    th: 'ด้วงคีมตัวผู้เดินบนเปลือกไม้',
    en: 'A male stag beetle walking on bark',
  }),
  stagHome: photo('Leeds stag beetles (9a).JPG', 'Storye book', 'CC BY-SA 4.0', {
    th: 'ด้วงคีมในกล่องเลี้ยงทรงโดมพร้อมวัสดุรองพื้น',
    en: 'A stag beetle in a dome enclosure with substrate',
  }),
  atlas: photo('Chalcosoma atlas m.jpg', 'JohnSka', 'CC BY-SA 3.0', {
    th: 'ด้วงกว่างสามเขาตัวผู้',
    en: 'A male Atlas beetle',
  }, 1200),
  atlasWings: photo('Atlas Beetle (wings open) - Zachi Evenor.jpg', 'MathKnight and Dr. Zachi Evenor', 'CC BY-SA 4.0', {
    th: 'ด้วงกว่างสามเขากางปีก',
    en: 'An Atlas beetle with its wings open',
  }, 1200),
  hercules: photo('Hercules beetle (Dynastes hercules).jpg', 'Novita Estiti', 'CC BY 2.0', {
    th: 'ด้วงเฮอร์คิวลิสเกาะแขนผู้เลี้ยง',
    en: "A Hercules beetle on its keeper's arm",
  }, 1200),
  stagTop: photo('Lucanus cervus male top 2.jpg', 'Simon A. Eugster', 'CC BY 3.0', {
    th: 'ด้วงคีมตัวผู้มองจากด้านบน',
    en: 'A male stag beetle seen from above',
  }, 1200),
} satisfies Record<string, BeetlePhoto>;
