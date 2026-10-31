// Dados fictícios do protótipo. Na implementação real, substituir por chamadas à API / banco de dados.

export const USER = { name: 'Paula Hooper', email: 'paula.hooper@fluiar.com.br', role: 'Arquiteta · Fluiar' };

export const CLIENTS = [
  { id: 'sergio-hooper', name: 'Sérgio Hooper', email: 'sergio.hooper@gmail.com', phone: '(31) 98842-1170', since: 'mar/2026', sinceLong: 'março de 2026', updated: 'Hoje, 14:20' },
  { id: 'marina-duarte', name: 'Marina Duarte', email: 'marina.duarte@outlook.com', phone: '(31) 99716-4083', since: 'ago/2026', sinceLong: 'agosto de 2026', updated: 'Ontem' },
  { id: 'rafael-livia-antunes', name: 'Rafael e Lívia Antunes', email: 'livia.antunes@gmail.com', phone: '(31) 98455-2391', since: 'jun/2026', sinceLong: 'junho de 2026', updated: '27 out' },
  { id: 'helena-prado', name: 'Helena Prado', email: 'helenaprado@uol.com.br', phone: '(31) 99230-5518', since: 'set/2026', sinceLong: 'setembro de 2026', updated: '22 out' },
  { id: 'clinica-vitta', name: 'Clínica Vitta', email: 'contato@clinicavitta.com.br', phone: '(31) 3822-4410', since: 'mai/2026', sinceLong: 'maio de 2026', updated: '15 out' },
  { id: 'bruno-teixeira', name: 'Bruno Teixeira', email: 'bruno.teixeira@gmail.com', phone: '(31) 98107-6624', since: 'jul/2026', sinceLong: 'julho de 2026', updated: '09 out' },
  { id: 'camila-rezende', name: 'Camila Rezende', email: 'camilarezende@icloud.com', phone: '(31) 99581-3047', since: 'out/2026', sinceLong: 'outubro de 2026', updated: '02 out' },
  { id: 'familia-lopes', name: 'Família Lopes', email: 'joao.lopes@yahoo.com.br', phone: '(31) 98670-9152', since: 'abr/2026', sinceLong: 'abril de 2026', updated: '28 set' },
];

export const LISTS = [
  { id: 'lista-da-casa', name: 'Lista de compras da casa', clientId: 'sergio-hooper', total: 17, bought: 5, updated: 'Hoje, 14:20', amount: 'R$ 4.041,30', description: 'Itens para a casa nova, separados por ambiente.' },
  { id: 'quarto-do-bebe', name: 'Quarto do bebê', clientId: 'rafael-livia-antunes', total: 21, bought: 6, updated: '27 out', description: 'Enxoval, berço e organização do quarto.' },
  { id: 'home-office', name: 'Home office', clientId: 'marina-duarte', total: 12, bought: 4, updated: 'Ontem', description: 'Cadeira, iluminação e organizadores para o escritório em casa.' },
  { id: 'banheiros', name: 'Banheiros', clientId: 'helena-prado', total: 10, bought: 3, updated: '22 out', description: 'Acessórios e metais dos dois banheiros.' },
  { id: 'cozinha-gourmet', name: 'Cozinha e área gourmet', clientId: 'rafael-livia-antunes', total: 16, bought: 11, updated: '25 out', description: 'Eletros, utensílios e mesa da área gourmet.' },
  { id: 'recepcao', name: 'Recepção', clientId: 'clinica-vitta', total: 14, bought: 9, updated: '15 out', description: 'Mobiliário, luminárias e decoração da recepção.' },
  { id: 'consultorios', name: 'Consultórios 1 e 2', clientId: 'clinica-vitta', total: 18, bought: 2, updated: '13 out', description: 'Cadeiras, armários e cortinas dos consultórios.' },
  { id: 'sala-de-estar', name: 'Sala de estar', clientId: 'bruno-teixeira', total: 11, bought: 5, updated: '09 out', description: 'Tapete, almofadas, luminária de piso.' },
  { id: 'mudanca', name: 'Mudança', clientId: 'familia-lopes', total: 15, bought: 8, updated: '28 set', description: 'Itens de primeira necessidade para a semana da mudança.' },
  { id: 'varanda', name: 'Varanda', clientId: 'rafael-livia-antunes', total: 7, bought: 0, updated: '20 out', description: 'Vasos, poltronas e iluminação externa.' },
  { id: 'enxoval-apartamento', name: 'Enxoval do apartamento', clientId: 'sergio-hooper', total: 9, bought: 9, updated: '02 out', amount: 'R$ 2.186,00', description: 'Cama, mesa e banho do apartamento.' },
];

export const ROOM_NAMES = ['Cozinha', 'Lavanderia', 'Churrasqueira', 'Suíte master', 'Banho master', 'Sala / jantar', 'Escritório', 'Banho escritório'];

// Produtos de exemplo, agrupados por ambiente (itens reais da lista original)
// links: [url, observação]
export const SAMPLE_ROOMS = [
  { name: 'Cozinha', items: [
    { id: 'p1', name: 'Liquidificador multiprocessador', links: [], bought: false, qty: 1, price: 389.9 },
    { id: 'p2', name: 'Extensão', links: [['https://meli.la/1TZX842', '10 metros ( tem a opção de 5m também)']], bought: false, qty: 1, price: 79.9 },
    { id: 'p3', name: 'Espremedor de laranja elétrico', links: [['https://meli.la/2hvsHvh', ''], ['https://meli.la/1GLu4DA', '']], bought: true, qty: 1, price: 149 },
    { id: 'p4', name: 'Batedeira', links: [['https://meli.la/1sNwTbN', 'Massas mais leves'], ['https://meli.la/2az7TXp', 'Bow de inox (durabilidade e limpeza)'], ['https://meli.la/1PbRQaa', 'Capacidade p/ massas pesadas (pão e pizza)']], bought: false, qty: 1, price: 459, notes: 'Para massas pesadas, escolher a opção 3.' },
    { id: 'p5', name: 'Forma para bolo', links: [['https://s.shopee.com.br/2gC2fextMk?share_channel_code=1', 'Básico'], ['https://s.shopee.com.br/4VdgrA0skI?share_channel_code=1', 'pão e cupcake de silicone']], bought: true, qty: 2, price: 39.9 },
    { id: 'p6', name: 'Jogo de peneira', links: [['https://s.shopee.com.br/9Kiwd888yO?share_channel_code=1', ''], ['https://meli.la/2eMP9Sw', 'Malha grossa']], bought: false, qty: 1, price: 54.9 },
    { id: 'p7', name: 'Organizadores de geladeira', links: [['https://meli.la/1kJ2urk', 'Porta frutas'], ['https://meli.la/1o5KGan', 'Porta folhas'], ['https://meli.la/1bMuCMs', 'Frios'], ['https://meli.la/2AbAra6', 'Frios (opção 2)']], bought: false, qty: 4, price: 42.5 },
  ] },
  { name: 'Lavanderia', items: [
    { id: 'p8', name: 'Pregador', links: [['https://meli.la/2UvUtk8', ''], ['https://meli.la/2g9SQ1c', '']], bought: true, qty: 2, price: 24.9 },
    { id: 'p9', name: 'Porta-detergente com bucha e rodinho', links: [['https://meli.la/19TWaJP', '']], bought: false, qty: 1, price: 69.9 },
    { id: 'p10', name: 'Caixa organizadora transparente', links: [], bought: false, qty: 3, price: null },
  ] },
  { name: 'Sala / jantar', items: [
    { id: 'p11', name: 'Capacho', links: [['https://levaoficina.com/products/capacho-chroma-sisal', 'Opção 1'], ['https://levaoficina.com/products/capacho-ada', 'Opção 2']], bought: false, qty: 1, price: 189 },
    { id: 'p12', name: 'Almofada destaque', links: [], bought: false, qty: 1, price: null },
    { id: 'p13', name: 'Tapete', links: [], bought: false, qty: 1, price: null },
  ] },
  { name: 'Escritório', items: [
    { id: 'p14', name: 'Cadeiras giratórias', links: [], bought: false, qty: 2, price: 1290 },
  ] },
  { name: 'Banho escritório', items: [
    { id: 'p15', name: 'Tapete e toalha de rosto nude', links: [], bought: true, qty: 1, price: 119.9 },
    { id: 'p16', name: 'Porta-sabonete madeira ou nude', links: [], bought: false, qty: 1, price: 59.9 },
    { id: 'p17', name: 'Encomendar espelho', links: [], bought: true, qty: 1, price: 680 },
  ] },
];

export const getClient = (id) => CLIENTS.find((c) => c.id === id);
export const getList = (id) => LISTS.find((l) => l.id === id);
export const listsOf = (clientId) => LISTS.filter((l) => l.clientId === clientId);
export const clientOf = (list) => getClient(list.clientId);
export const getProduct = (id) => {
  for (const r of SAMPLE_ROOMS) { const p = r.items.find((i) => i.id === id); if (p) return { ...p, room: r.name }; }
  return null;
};
