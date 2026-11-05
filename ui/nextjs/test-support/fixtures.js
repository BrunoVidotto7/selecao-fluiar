const CREATED_AT = '2026-10-31T12:00:00Z';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const LIST_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const SECOND_ROOM_ID = '33333333-3333-4333-8333-333333335555';
const CLIENT_NAME = 'Mariana Souza';

export const ME = {
  id: '88888888-8888-4888-8888-888888888888',
  role: 'ADMIN',
  clientId: null,
  officeId: '77777777-7777-4777-8777-777777777777',
  officeName: 'Escritório de Ana Lima',
  name: 'Ana Lima',
  email: 'ana@example.com',
};

export const OFFICE = {
  id: ME.officeId,
  name: ME.officeName,
  members: [{ id: ME.id, name: ME.name, email: ME.email }],
};

export const INVITATION = {
  id: '99999999-9999-4999-8999-999999999999',
  email: 'new@example.com',
  createdAt: '2026-10-31T12:00:00Z',
  expiresAt: '2026-11-07T12:00:00Z',
};

export const PRODUCT = {
  id: '44444444-4444-4444-8444-444444444444',
  roomId: ROOM_ID,
  name: 'Batedeira',
  quantity: 2,
  unitPrice: 12.50,
  notes: 'Conferir as medidas.',
  clientNotes: null,
  bought: false,
  imageUrl: null,
  links: [{ url: 'https://example.com/batedeira', note: null }],
};

export const SECOND_PRODUCT = {
  ...PRODUCT,
  id: '44444444-4444-4444-8444-444444446666',
  roomId: SECOND_ROOM_ID,
  name: 'Sofá',
};

export const ROOM = { id: ROOM_ID, name: 'Cozinha', position: 0, products: [PRODUCT] };
export const SECOND_ROOM = { id: SECOND_ROOM_ID, name: 'Sala', position: 1, products: [SECOND_PRODUCT] };

export const LIST = {
  clientChanges: { observedRevision: 0, products: [] },
  id: LIST_ID,
  name: 'Casa nova',
  description: 'Seleção para a casa nova.',
  clientId: CLIENT_ID,
  clientName: CLIENT_NAME,
  shareToken: 'a'.repeat(43),
  updatedAt: CREATED_AT,
  stats: { totalProducts: 1, boughtProducts: 0, pendingProducts: 1, estimatedTotal: 25, remainingTotal: 25 },
  rooms: [ROOM],
};

const LIST_SUMMARY = {
  id: LIST.id,
  name: LIST.name,
  description: LIST.description,
  clientId: LIST.clientId,
  clientName: LIST.clientName,
  totalProducts: LIST.stats.totalProducts,
  boughtProducts: LIST.stats.boughtProducts,
  estimatedTotal: LIST.stats.estimatedTotal,
  updatedAt: LIST.updatedAt,
  completed: false,
};

export const CLIENT = {
  id: CLIENT_ID,
  name: CLIENT_NAME,
  email: 'mariana@example.com',
  phone: '31999998888',
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  lists: [LIST_SUMMARY],
};

export const DASHBOARD = {
  clientCount: 1,
  clientsCreatedThisMonth: 1,
  listCount: 1,
  completedListCount: 0,
  listsWithPendingProductsCount: 1,
  totalProductCount: 1,
  pendingProductCount: 1,
  recentClients: [{
    id: CLIENT.id,
    name: CLIENT.name,
    email: CLIENT.email,
    phone: CLIENT.phone,
    listCount: 1,
    createdAt: CLIENT.createdAt,
    updatedAt: CLIENT.updatedAt,
  }],
  recentLists: [LIST_SUMMARY],
};

export const PUBLIC_LIST = {
  name: LIST.name,
  description: LIST.description,
  rooms: [{
    name: ROOM.name,
    products: [{ name: PRODUCT.name, quantity: PRODUCT.quantity, bought: PRODUCT.bought, links: PRODUCT.links }],
  }],
  signature: { officeName: ME.officeName, architectNames: [ME.name] },
};

export const CLIENT_ME = { ...ME, id: '88888888-8888-4888-8888-888888885555', role: 'CLIENT', clientId: CLIENT_ID, name: CLIENT_NAME, email: 'mariana@example.com' };

export const CLIENT_ACCESS = { status: 'NOT_INVITED', email: CLIENT.email, invitationId: null, expiresAt: null };

export const CLIENT_PRODUCT = {
  id: PRODUCT.id, name: PRODUCT.name, quantity: PRODUCT.quantity, bought: false, clientNotes: null,
  links: [{ url: 'https://example.com/batedeira', note: null }],
};
export const CLIENT_LIST = {
  id: LIST.id, name: LIST.name, description: LIST.description, updatedAt: LIST.updatedAt,
  stats: { totalProducts: 1, boughtProducts: 0, pendingProducts: 1 },
  rooms: [{ id: ROOM.id, name: ROOM.name, position: 0, products: [CLIENT_PRODUCT] }],
  signature: { officeName: ME.officeName, architectNames: [ME.name] },
};
export const CLIENT_LIST_SUMMARY = {
  id: CLIENT_LIST.id, name: CLIENT_LIST.name, description: CLIENT_LIST.description, updatedAt: CLIENT_LIST.updatedAt,
  totalProducts: 1, boughtProducts: 0, pendingProducts: 1, completed: false,
};
