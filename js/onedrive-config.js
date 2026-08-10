const ONEDRIVE_CONFIG = {
  // Azure App Registration → Application (client) ID
  clientId: 'bcd09a7f-95d3-4ce6-986c-a78f82ea1def',

  // 'common' works for both personal and work Microsoft accounts.
  // Replace with your tenant ID if you want to restrict to one organisation.
  tenantId: 'f8809024-638d-4570-9652-cb9c094a5faa',

  // OneDrive folder that will hold products.xlsx and products.json.
  folderPath: 'ProductSelector',

  // GitHub repo where images and datasheets are stored (must match your GitHub Pages repo).
  githubOwner: 'ananthr99',
  githubRepo:  'INVENDIS-ProductSelector',
  githubBranch: 'main',

  // GitHub Gist ID — filled in automatically after first Save & Publish in admin.
  gistId: '57765f919922afcc14bce0bfd78b2b10',

  // Raw Gist URL — main site fetches products from this URL.
  productsJsonUrl: 'https://gist.githubusercontent.com/ananthr99/57765f919922afcc14bce0bfd78b2b10/raw/products.json'
};
