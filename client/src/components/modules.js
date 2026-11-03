/** The three parts of the site, and the pages inside each. Used by the menu, the page heads and the footer. */
export const MODULES = [
  {
    key: 'sanskriti',
    base: '/sanskriti',
    items: [
      { to: '/sanskriti/festivals', label: 'nav.festivals' },
      { to: '/sanskriti/oral-history', label: 'nav.oral' },
      { to: '/sanskriti/wiki', label: 'nav.wiki' },
      { to: '/sanskriti/gallery', label: 'nav.gallery' },
    ],
  },
  {
    key: 'vikas',
    base: '/vikas',
    items: [
      { to: '/vikas', label: 'nav.projects', also: ['/vikas/projects'] },
      { to: '/vikas/map', label: 'nav.map' },
      { to: '/vikas/notices', label: 'nav.notices' },
    ],
  },
  {
    key: 'sampark',
    base: '/sampark',
    items: [
      { to: '/sampark/directory', label: 'nav.directory' },
      { to: '/sampark/youth', label: 'nav.youth' },
      { to: '/sampark/fame', label: 'nav.fame' },
      { to: '/sampark/contribute', label: 'nav.contribute' },
    ],
  },
];
