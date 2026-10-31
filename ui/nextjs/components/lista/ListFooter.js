// Nota da página original e assinatura recebida da API.
export function ListNote() {
  return (
    <aside className="disc">
      <b>Nota</b>
      <p>As opções desta lista foram selecionadas pela Fluiar com todo cuidado, considerando o projeto, a qualidade e a procedência de cada loja. Ainda assim, como as compras são feitas diretamente com os vendedores, podem ocorrer intercorrências.</p>
      <p>A Fluiar não realiza vendas nem se responsabiliza pelas transações. Se algo acontecer, estamos à disposição para orientar sobre os seus direitos como consumidor junto à loja.</p>
    </aside>
  );
}

/** @param {{ signature: { officeName: string, architectNames: string[] } }} props */
export function ListSignature({ signature }) {
  return (
    <div className="sign">
      <div className="sg">
        <span className="logo">{signature.officeName}</span>
        <span className="arqs">{signature.architectNames.map((name, index) => <span key={index}>{name}</span>)}</span>
      </div>
    </div>
  );
}
